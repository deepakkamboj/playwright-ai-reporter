// Global state
let testSummary = null;
let testFailures = null;
let allTestsData = [];
let flakyTestsData = [];
let charts = {};
let gridApis = {};

// Artifacts base path - configurable
const ARTIFACTS_PATH = '.playwright-test-results/artifacts';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Wait for AG Grid to be available
  if (typeof agGrid !== 'undefined') {
    loadTestData();
  } else {
    // Retry after a short delay if AG Grid hasn't loaded yet
    setTimeout(() => {
      loadTestData();
    }, 500);
  }
});

// Load test data - supports embedded data (for direct file opening) or fetch (for server mode)
async function loadTestData() {
  try {
    showLoading();

    // Check for embedded data first (allows opening HTML directly without server)
    if (window.EMBEDDED_TEST_SUMMARY && window.EMBEDDED_TEST_FAILURES) {
      console.log('Using embedded test data');
      testSummary = window.EMBEDDED_TEST_SUMMARY;
      const failuresData = window.EMBEDDED_TEST_FAILURES;
      testFailures = Array.isArray(failuresData) ? { failures: failuresData } : failuresData;
    } else {
      // Try to fetch from server
      console.log('Attempting to fetch test data from server...');
      const [summaryResponse, failuresResponse] = await Promise.all([
        fetch(`${ARTIFACTS_PATH}/testSummary.json`).catch(() => ({ ok: false })),
        fetch(`${ARTIFACTS_PATH}/testFailures.json`).catch(() => ({ ok: false })),
      ]);

      if (summaryResponse.ok) {
        testSummary = await summaryResponse.json();
      } else {
        console.warn('testSummary.json not found, using sample data');
        testSummary = generateSampleSummary();
      }

      if (failuresResponse.ok) {
        const failuresData = await failuresResponse.json();
        testFailures = Array.isArray(failuresData) ? { failures: failuresData } : failuresData;
      } else {
        console.warn('testFailures.json not found, using sample data');
        testFailures = generateSampleFailures();
      }
    }

    // Process and render data
    processTestData();
    renderAllComponents();
    hideLoading();
  } catch (error) {
    console.error('Error loading test data:', error);
    showError('Failed to load test data. Using sample data.');
    testSummary = generateSampleSummary();
    testFailures = generateSampleFailures();
    processTestData();
    renderAllComponents();
    hideLoading();
  }
}

// Process test data and extract insights
function processTestData() {
  // Combine summary and failure data
  allTestsData = [];
  flakyTestsData = [];

  // Build a map of failed tests for quick lookup
  const failedTestMap = new Map();
  if (testFailures && testFailures.failures) {
    testFailures.failures.forEach((failure) => {
      failedTestMap.set(failure.testId, failure);
    });
  }

  // Process all test cases from testSummary (this has the complete list)
  if (testSummary && testSummary.allTestCases) {
    testSummary.allTestCases.forEach((testCase) => {
      const failure = failedTestMap.get(testCase.testId);
      const isFlaky = failure && failure.retryCount > 0;

      // Generate artifact folder name for failed tests
      const artifactFolder = failure ? generateArtifactFolderName(testCase) : null;

      const test = {
        id: testCase.testId || generateId(),
        name: testCase.testTitle,
        suite: testCase.suiteTitle,
        file: testCase.testFile || 'N/A',
        status: isFlaky ? 'flaky' : testCase.status,
        duration: failure ? failure.duration : testCase.duration || 0,
        error: failure ? failure.errorMessage : null,
        stackTrace: failure ? failure.errorStack : null,
        category: failure ? failure.errorCategory || 'Unknown' : 'N/A',
        retries: failure ? failure.retryCount || 0 : 0,
        owningTeam: testCase.owningTeam || 'Unknown',
        location: testCase.location,
        artifactFolder: artifactFolder,
        timestamp: testSummary.timestamp || new Date().toISOString(),
      };

      allTestsData.push(test);

      if (isFlaky) {
        flakyTestsData.push({
          ...test,
          failureRate: calculateFailureRate(failure.retryCount),
          pattern: identifyFlakyPattern(failure),
        });
      }
    });
  } else if (testFailures && testFailures.failures) {
    // Fallback: process from failures if allTestCases not available
    testFailures.failures.forEach((failure) => {
      const artifactFolder = generateArtifactFolderNameFromFailure(failure);
      const test = {
        id: failure.testId || generateId(),
        name: failure.testTitle,
        suite: failure.suiteTitle,
        file: failure.testFile || 'N/A',
        status: failure.retryCount > 0 ? 'flaky' : 'failed',
        duration: failure.duration || 0,
        error: failure.errorMessage,
        stackTrace: failure.errorStack,
        category: failure.errorCategory || 'Unknown',
        retries: failure.retryCount || 0,
        owningTeam: failure.owningTeam || 'Unknown',
        location: failure.location,
        artifactFolder: artifactFolder,
        timestamp: failure.timestamp || new Date().toISOString(),
      };

      allTestsData.push(test);

      if (test.status === 'flaky') {
        flakyTestsData.push({
          ...test,
          failureRate: calculateFailureRate(failure.retryCount),
          pattern: identifyFlakyPattern(failure),
        });
      }
    });
  }
}

// Generate artifact folder name based on Playwright's naming convention
function generateArtifactFolderName(testCase) {
  // Playwright generates folder names like:
  // powerapps-page-Power-Apps--15021-hould-find-Default-Solution-Playwright-Power-Apps-Integration-Tests
  const testFile = testCase.testFile
    ? testCase.testFile.split(/[/\\]/).pop().replace('.spec.ts', '')
    : 'test';
  const suiteTitle = (testCase.suiteTitle || '').replace(/[^a-zA-Z0-9]/g, '-');
  const testTitle = (testCase.testTitle || '').replace(/[^a-zA-Z0-9]/g, '-');

  // Try to find matching folder in artifacts
  return `${testFile}-${suiteTitle}--*-${testTitle}*`;
}

function generateArtifactFolderNameFromFailure(failure) {
  return generateArtifactFolderName({
    testFile: failure.testFile,
    suiteTitle: failure.suiteTitle,
    testTitle: failure.testTitle,
  });
}

// Render all dashboard components
function renderAllComponents() {
  console.log('Rendering all components...');
  console.log('allTestsData length:', allTestsData.length);
  console.log('flakyTestsData length:', flakyTestsData.length);

  updateSummaryCards();
  updateHeaderMeta();
  renderCharts();
  renderFailedTestsGrid();
  renderFlakyTestsGrid();
  renderSlowestTestsGrid();
  renderAllTestsGrid();

  console.log('All components rendered');
}

// Update summary cards
function updateSummaryCards() {
  const stats = calculateStats();

  document.getElementById('passedTests').textContent = stats.passed;
  document.getElementById('failedTests').textContent = stats.failed;
  document.getElementById('flakyTests').textContent = stats.flaky;
  document.getElementById('skippedTests').textContent = stats.skipped;
  document.getElementById('totalDuration').textContent = formatDuration(stats.totalDuration);
  document.getElementById('avgDuration').textContent = formatDuration(stats.avgDuration);
  document.getElementById('successRate').textContent = stats.successRate + '%';
  document.getElementById('failureRate').textContent = stats.failureRate + '%';
}

// Update header metadata
function updateHeaderMeta() {
  const lastUpdated = testSummary?.timestamp
    ? new Date(testSummary.timestamp).toLocaleString()
    : new Date().toLocaleString();
  const environment = testSummary?.runEnvironment || testSummary?.environment || 'Local';
  const buildInfo = testSummary?.buildInfo?.executionSystem || testSummary?.buildInfo || 'N/A';

  document.getElementById('lastUpdated').textContent = `Last Updated: ${lastUpdated}`;
  document.getElementById('testEnvironment').textContent = `Environment: ${environment}`;
  document.getElementById('buildInfo').textContent = `Build: ${buildInfo}`;
}

// Calculate statistics
function calculateStats() {
  // Use testSummary counts if available (more accurate)
  const passed =
    testSummary?.passedCount ?? allTestsData.filter((t) => t.status === 'passed').length;
  const failed =
    testSummary?.failedCount ?? allTestsData.filter((t) => t.status === 'failed').length;
  const flaky = flakyTestsData.length;
  const skipped =
    testSummary?.skippedCount ?? allTestsData.filter((t) => t.status === 'skipped').length;
  const total = testSummary?.testCount ?? allTestsData.length;
  const totalDuration = allTestsData.reduce((sum, t) => sum + (t.duration || 0), 0);
  const avgDuration = total > 0 ? totalDuration / total : 0;
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const failureRate = total > 0 ? Math.round((failed / total) * 100) : 0;

  return {
    passed,
    failed,
    flaky,
    skipped,
    total,
    totalDuration,
    avgDuration,
    successRate,
    failureRate,
  };
}

// Render charts
function renderCharts() {
  renderTestResultsChart();
  renderTestTrendChart();
  renderFailureCategoriesChart();
  renderDurationChart();
}

// Test Results Pie Chart
function renderTestResultsChart() {
  const ctx = document.getElementById('testResultsChart');
  const stats = calculateStats();

  if (charts.testResults) {
    charts.testResults.destroy();
  }

  charts.testResults = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Passed', 'Failed', 'Flaky', 'Skipped'],
      datasets: [
        {
          data: [stats.passed, stats.failed, stats.flaky, stats.skipped],
          backgroundColor: ['#28a745', '#dc3545', '#ffc107', '#6c757d'],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: { size: 12 },
            generateLabels: function (chart) {
              const data = chart.data;
              const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                return {
                  text: `${label}: ${value} (${percentage}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i,
                };
              });
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

// Test Trend Line Chart (simulated historical data)
function renderTestTrendChart() {
  const ctx = document.getElementById('testTrendChart');

  if (charts.testTrend) {
    charts.testTrend.destroy();
  }

  // Simulate historical trend data
  const runs = generateTrendData();

  charts.testTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: runs.map((r) => r.date),
      datasets: [
        {
          label: 'Passed',
          data: runs.map((r) => r.passed),
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Failed',
          data: runs.map((r) => r.failed),
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 15 },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: function (context) {
              return 'Run: ' + context[0].label;
            },
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y} tests`;
            },
          },
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: {
            display: true,
            text: 'Number of Tests',
          },
        },
        x: {
          title: {
            display: true,
            text: 'Test Run',
          },
        },
      },
    },
  });
}

// Failure Categories Bar Chart
function renderFailureCategoriesChart() {
  const ctx = document.getElementById('failureCategoriesChart');

  if (charts.failureCategories) {
    charts.failureCategories.destroy();
  }

  // Count failures by category
  const categories = {};
  testFailures?.failures?.forEach((f) => {
    const cat = f.category || 'Unknown';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const labels = Object.keys(categories);
  const data = Object.values(categories);

  charts.failureCategories = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Number of Failures',
          data: data,
          backgroundColor: [
            '#dc3545',
            '#ff6b6b',
            '#ee5a6f',
            '#f77f7f',
            '#ff9999',
            '#ffb3b3',
            '#ffc9c9',
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Failure Categories',
          font: { size: 14, weight: 'bold' },
          padding: { bottom: 10 },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.parsed.y} failure${context.parsed.y !== 1 ? 's' : ''}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: {
            display: true,
            text: 'Number of Failures',
          },
        },
        x: {
          title: {
            display: true,
            text: 'Error Category',
          },
        },
      },
    },
  });
}

// Duration Analysis Chart
function renderDurationChart() {
  const ctx = document.getElementById('durationChart');

  if (charts.duration) {
    charts.duration.destroy();
  }

  // Get slowest tests from testSummary or allTestsData
  let slowestTests = [];
  if (testSummary && testSummary.slowestTests && testSummary.slowestTests.length > 0) {
    slowestTests = testSummary.slowestTests.slice(0, 10);
  } else {
    slowestTests = [...allTestsData]
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map((t) => ({ testTitle: t.name, duration: t.duration / 1000 }));
  }

  charts.duration = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: slowestTests.map((t) => truncateString(t.testTitle, 25)),
      datasets: [
        {
          label: 'Duration (seconds)',
          data: slowestTests.map((t) => t.duration.toFixed(2)),
          backgroundColor: '#17a2b8',
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Slowest Tests',
          font: { size: 14, weight: 'bold' },
          padding: { bottom: 10 },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `Duration: ${context.parsed.x} seconds`;
            },
            title: function (context) {
              // Show full test name in tooltip
              const index = context[0].dataIndex;
              return slowestTests[index]?.testTitle || context[0].label;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Duration (seconds)',
          },
        },
        y: {
          title: {
            display: true,
            text: 'Test Name',
          },
        },
      },
    },
  });
}

// Render Failed Tests Grid
function renderFailedTestsGrid() {
  const failedTests = allTestsData.filter((t) => t.status === 'failed');
  console.log('Rendering Failed Tests Grid - Count:', failedTests.length);

  const columnDefs = [
    {
      headerName: 'Test Name',
      field: 'name',
      flex: 2,
      cellRenderer: (params) => `<strong>${escapeHtml(params.value)}</strong>`,
    },
    {
      headerName: 'Suite',
      field: 'suite',
      width: 180,
      cellRenderer: (params) =>
        `<span class="suite-badge">${escapeHtml(params.value || 'N/A')}</span>`,
    },
    {
      headerName: 'Duration',
      field: 'duration',
      width: 120,
      valueFormatter: (params) => formatDuration(params.value),
    },
    {
      headerName: 'Error',
      field: 'error',
      flex: 2,
      cellRenderer: (params) =>
        `<span title="${escapeHtml(params.value || '')}">${escapeHtml(truncateString(params.value || 'N/A', 60))}</span>`,
    },
    {
      headerName: 'Actions',
      width: 300,
      cellRenderer: (params) => {
        const testId = escapeHtml(params.data.id);
        return `
                    <button class="grid-action-btn btn-fix" onclick="generateAIFix('${testId}')">
                        <i class="fas fa-robot"></i> AI Fix
                    </button>
                    <button class="grid-action-btn btn-artifacts" onclick="viewArtifacts('${testId}')">
                        <i class="fas fa-paperclip"></i> Artifacts
                    </button>
                    <button class="grid-action-btn btn-trace" onclick="openTraceViewer('${testId}')">
                        <i class="fas fa-search"></i> Trace
                    </button>
                `;
      },
    },
  ];

  const gridOptions = {
    columnDefs: columnDefs,
    rowData: failedTests,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
    },
    domLayout: 'autoHeight',
    onGridReady: (params) => {
      gridApis.failedTests = params.api;
      params.api.sizeColumnsToFit();
    },
  };

  const gridDiv = document.querySelector('#failedTestsGrid');
  gridDiv.innerHTML = '';

  // Create grid using AG Grid Community API
  try {
    if (typeof agGrid !== 'undefined') {
      if (agGrid.createGrid) {
        // AG Grid v31+ API
        gridApis.failedTests = agGrid.createGrid(gridDiv, gridOptions);
      } else if (agGrid.Grid) {
        // Legacy AG Grid API
        new agGrid.Grid(gridDiv, gridOptions);
      }
    } else {
      console.error('AG Grid not loaded properly');
      gridDiv.innerHTML =
        '<p class="error-message">Failed to load data grid. Please refresh the page.</p>';
    }
  } catch (error) {
    console.error('Error creating failed tests grid:', error);
    gridDiv.innerHTML = '<p class="error-message">Error loading data grid.</p>';
  }
}

// Render Flaky Tests Grid
function renderFlakyTestsGrid() {
  const columnDefs = [
    {
      headerName: 'Test Name',
      field: 'name',
      flex: 2,
      cellRenderer: (params) => `<strong>${escapeHtml(params.value)}</strong>`,
    },
    {
      headerName: 'Retries',
      field: 'retries',
      width: 100,
      cellStyle: { fontWeight: 'bold', color: '#ffc107' },
    },
    {
      headerName: 'Failure Rate',
      field: 'failureRate',
      width: 130,
      valueFormatter: (params) => `${params.value}%`,
    },
    {
      headerName: 'Pattern',
      field: 'pattern',
      flex: 1,
    },
    {
      headerName: 'Actions',
      width: 280,
      cellRenderer: (params) => {
        const testId = escapeHtml(params.data.id);
        return `
                    <button class="grid-action-btn btn-fix" onclick="generateAIFix('${testId}')">
                        <i class="fas fa-robot"></i> AI Fix
                    </button>
                    <button class="grid-action-btn btn-view" onclick="viewFlakyDetails('${testId}')">
                        <i class="fas fa-search"></i> Details
                    </button>
                    <button class="grid-action-btn btn-trace" onclick="openTraceViewer('${testId}')">
                        <i class="fas fa-external-link-alt"></i> Trace
                    </button>
                `;
      },
    },
  ];

  const gridOptions = {
    columnDefs: columnDefs,
    rowData: flakyTestsData,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
    },
    domLayout: 'autoHeight',
    onGridReady: (params) => {
      gridApis.flakyTests = params.api;
      params.api.sizeColumnsToFit();
    },
  };

  const gridDiv = document.querySelector('#flakyTestsGrid');
  gridDiv.innerHTML = '';

  // Create grid using AG Grid Community API
  try {
    if (typeof agGrid !== 'undefined') {
      if (agGrid.createGrid) {
        gridApis.flakyTests = agGrid.createGrid(gridDiv, gridOptions);
      } else if (agGrid.Grid) {
        new agGrid.Grid(gridDiv, gridOptions);
      }
    } else {
      console.error('AG Grid not loaded properly');
    }
  } catch (error) {
    console.error('Error creating flaky tests grid:', error);
  }
}

// Render Slowest Tests Grid
function renderSlowestTestsGrid() {
  // Use slowestTests from testSummary if available
  let slowestTests = [];
  if (testSummary && testSummary.slowestTests && testSummary.slowestTests.length > 0) {
    slowestTests = testSummary.slowestTests.map((t, index) => ({
      rank: index + 1,
      name: t.testTitle,
      duration: t.duration * 1000, // Convert seconds to ms if needed
      file: 'N/A',
      status: 'passed',
    }));
  } else {
    slowestTests = [...allTestsData]
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);
  }

  const columnDefs = [
    { headerName: 'Rank', valueGetter: 'node.rowIndex + 1', width: 80 },
    {
      headerName: 'Test Name',
      field: 'name',
      flex: 2,
      cellRenderer: (params) => escapeHtml(params.value),
    },
    {
      headerName: 'Duration',
      field: 'duration',
      width: 150,
      valueFormatter: (params) => formatDuration(params.value),
      cellStyle: { fontWeight: 'bold', color: '#dc3545' },
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 120,
      cellRenderer: (params) =>
        `<span class="status-badge status-${params.value}">${params.value}</span>`,
    },
  ];

  const gridOptions = {
    columnDefs: columnDefs,
    rowData: slowestTests,
    defaultColDef: {
      sortable: true,
      resizable: true,
    },
    domLayout: 'autoHeight',
    onGridReady: (params) => {
      gridApis.slowestTests = params.api;
      params.api.sizeColumnsToFit();
    },
  };

  const gridDiv = document.querySelector('#slowestTestsGrid');
  gridDiv.innerHTML = '';

  // Create grid using AG Grid Community API
  try {
    if (typeof agGrid !== 'undefined') {
      if (agGrid.createGrid) {
        gridApis.slowestTests = agGrid.createGrid(gridDiv, gridOptions);
      } else if (agGrid.Grid) {
        new agGrid.Grid(gridDiv, gridOptions);
      }
    } else {
      console.error('AG Grid not loaded properly');
    }
  } catch (error) {
    console.error('Error creating slowest tests grid:', error);
  }
}

// Render All Tests Grid - Playwright-style list with icons
function renderAllTestsGrid() {
  const gridDiv = document.querySelector('#allTestsGrid');

  // Group tests by suite
  const testsBySuite = {};
  allTestsData.forEach((test) => {
    const suite = test.suite || 'Other Tests';
    if (!testsBySuite[suite]) {
      testsBySuite[suite] = [];
    }
    testsBySuite[suite].push(test);
  });

  // Create HTML structure similar to Playwright HTML report
  let html = '<div class="pw-test-list">';

  for (const [suiteName, tests] of Object.entries(testsBySuite)) {
    // Calculate suite stats
    const passed = tests.filter((t) => t.status === 'passed').length;
    const failed = tests.filter((t) => t.status === 'failed').length;
    const skipped = tests.filter((t) => t.status === 'skipped').length;
    const flaky = tests.filter((t) => t.status === 'flaky').length;
    const totalDuration = tests.reduce((sum, t) => sum + (t.duration || 0), 0);

    html += `
            <div class="pw-suite">
                <div class="pw-suite-header" onclick="toggleSuite(this)">
                    <span class="pw-suite-toggle"><i class="fas fa-chevron-down"></i></span>
                    <span class="pw-suite-icon"><i class="fas fa-folder"></i></span>
                    <span class="pw-suite-name">${escapeHtml(suiteName)}</span>
                    <span class="pw-suite-stats">
                        ${passed > 0 ? `<span class="pw-stat pw-stat-passed">${passed}</span>` : ''}
                        ${failed > 0 ? `<span class="pw-stat pw-stat-failed">${failed}</span>` : ''}
                        ${flaky > 0 ? `<span class="pw-stat pw-stat-flaky">${flaky}</span>` : ''}
                        ${skipped > 0 ? `<span class="pw-stat pw-stat-skipped">${skipped}</span>` : ''}
                    </span>
                    <span class="pw-suite-duration">${formatDuration(totalDuration)}</span>
                </div>
                <div class="pw-suite-tests">
        `;

    tests.forEach((test) => {
      const statusIcon = getStatusIcon(test.status);
      const statusClass = `pw-test-${test.status}`;
      const hasArtifacts = test.status === 'failed' || test.status === 'flaky';

      html += `
                <div class="pw-test ${statusClass}" data-test-id="${escapeHtml(test.id)}">
                    <span class="pw-test-status">${statusIcon}</span>
                    <span class="pw-test-name">${escapeHtml(test.name)}</span>
                    <span class="pw-test-duration">${formatDuration(test.duration)}</span>
                    ${
                      hasArtifacts
                        ? `
                        <span class="pw-test-actions">
                            <button class="pw-action-btn" onclick="viewArtifacts('${escapeHtml(test.id)}')" title="View Artifacts">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <button class="pw-action-btn" onclick="openTraceViewer('${escapeHtml(test.id)}')" title="View Trace">
                                <i class="fas fa-search"></i>
                            </button>
                        </span>
                    `
                        : ''
                    }
                </div>
            `;
    });

    html += `
                </div>
            </div>
        `;
  }

  html += '</div>';
  gridDiv.innerHTML = html;
  gridDiv.style.height = 'auto';
}

// Get status icon similar to Playwright HTML report
function getStatusIcon(status) {
  switch (status) {
    case 'passed':
      return '<i class="fas fa-check-circle pw-icon-passed"></i>';
    case 'failed':
      return '<i class="fas fa-times-circle pw-icon-failed"></i>';
    case 'flaky':
      return '<i class="fas fa-exclamation-circle pw-icon-flaky"></i>';
    case 'skipped':
      return '<i class="fas fa-minus-circle pw-icon-skipped"></i>';
    default:
      return '<i class="fas fa-question-circle"></i>';
  }
}

// Toggle suite collapse/expand
function toggleSuite(header) {
  const suite = header.parentElement;
  const tests = suite.querySelector('.pw-suite-tests');
  const toggle = header.querySelector('.pw-suite-toggle i');

  if (tests.style.display === 'none') {
    tests.style.display = 'block';
    toggle.className = 'fas fa-chevron-down';
  } else {
    tests.style.display = 'none';
    toggle.className = 'fas fa-chevron-right';
  }
}

// Open trace viewer for a test
function openTraceViewer(testId) {
  const test = allTestsData.find((t) => t.id === testId);
  if (!test) {
    alert('Test not found');
    return;
  }

  // Find artifact folder for this test
  const artifactFolder = findArtifactFolder(test);
  if (artifactFolder) {
    // Build the absolute file path to the trace.zip
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const traceZipPath = `${basePath}/${ARTIFACTS_PATH}/${artifactFolder}/trace.zip`;

    // Get the absolute path for the trace viewer and trace file
    const origin = window.location.origin;
    const protocol = window.location.protocol;

    // For file:// protocol, construct local paths
    if (protocol === 'file:') {
      // Convert to absolute file path
      const fullTracePath = `file://${traceZipPath.replace(/^\/([a-zA-Z]):/, '$1:')}`;
      const traceViewerPath =
        `file://${basePath}/.playwright-test-results/html-report/trace/index.html`.replace(
          /^\/([a-zA-Z]):/,
          '$1:'
        );

      // Open local trace viewer with trace file as query parameter
      const traceViewerUrl = `${traceViewerPath}?trace=${encodeURIComponent(fullTracePath)}`;
      window.open(traceViewerUrl, '_blank');
    } else {
      // For http(s), use the online trace viewer or show instructions
      showTraceViewerInstructions(test, `${ARTIFACTS_PATH}/${artifactFolder}/trace.zip`);
    }
  } else {
    alert('No trace file found for this test. Make sure the test was run with tracing enabled.');
  }
}

// Show instructions for opening trace in trace.playwright.dev
function showTraceViewerInstructions(test, traceUrl) {
  const modal = document.getElementById('aiFixModal');
  modal.style.display = 'block';

  document.getElementById('modalTestName').textContent = `Trace Viewer: ${test.name}`;
  document.getElementById('modalTestFile').textContent = `File: ${test.file}`;
  document.getElementById('modalTestCategory').textContent = `Suite: ${test.suite || 'N/A'}`;
  document.getElementById('modalErrorMessage').textContent =
    test.error || 'View trace to analyze test execution';

  const aiFix = document.getElementById('aiFix');
  aiFix.innerHTML = `
        <div class="trace-instructions">
            <h4><i class="fas fa-play-circle"></i> Open Trace in Playwright Trace Viewer</h4>
            <p>To view the detailed trace for this test:</p>
            <ol>
                <li>
                    <strong>Option 1: Online Viewer</strong><br>
                    <a href="https://trace.playwright.dev/" target="_blank" class="btn btn-primary">
                        <i class="fas fa-external-link-alt"></i> Open trace.playwright.dev
                    </a>
                    <br><small>Then drag and drop the trace.zip file into the viewer</small>
                </li>
                <li style="margin-top: 15px;">
                    <strong>Option 2: Download Trace File</strong><br>
                    <a href="${escapeHtml(traceUrl)}" download="trace.zip" class="btn btn-secondary">
                        <i class="fas fa-download"></i> Download trace.zip
                    </a>
                </li>
                <li style="margin-top: 15px;">
                    <strong>Option 3: Local CLI</strong><br>
                    <code class="code-block">npx playwright show-trace "${escapeHtml(traceUrl)}"</code>
                </li>
            </ol>
        </div>
    `;

  // Populate artifacts
  const artifactsDiv = document.getElementById('modalArtifacts');
  artifactsDiv.innerHTML = renderArtifactItems(test);
}

// Find artifact folder for a test
function findArtifactFolder(test) {
  // Generate expected folder pattern based on test info
  if (!test.file || !test.name) return null;

  // Look for matching failure in testFailures to get exact folder name
  const failure = testFailures?.failures?.find((f) => f.testId === test.id);
  if (failure) {
    // Build folder name pattern similar to Playwright's naming
    const testFile = (failure.testFile || '').split(/[/\\]/).pop().replace('.spec.ts', '');
    const testSlug = (failure.testTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Return a partial match pattern - in real implementation,
    // you would scan the artifacts directory or maintain a mapping
    return findMatchingArtifactFolder(testFile, failure.suiteTitle, testSlug);
  }
  return null;
}

// Known artifact folders - loaded dynamically or hard-coded
let knownArtifactFolders = [
  'powerapps-page-Power-Apps--15021-hould-find-Default-Solution-Playwright-Power-Apps-Integration-Tests',
  'powerapps-page-Power-Apps--7a539-hould-open-default-solution-Playwright-Power-Apps-Integration-Tests',
];

// Find matching artifact folder from known folders
function findMatchingArtifactFolder(testFile, suiteTitle, testSlug) {
  if (!testFile || !testSlug) return null;

  // Normalize for comparison
  const testFileLower = testFile.toLowerCase();
  const testSlugLower = testSlug.toLowerCase();

  // Find folder that matches the test
  const matchingFolder = knownArtifactFolders.find((folder) => {
    const folderLower = folder.toLowerCase();

    // Check if folder contains test file name and part of test slug
    const containsFile = folderLower.includes(testFileLower);
    const containsTest = testSlugLower
      .split('-')
      .slice(0, 4)
      .some((part) => part.length > 2 && folderLower.includes(part));

    return containsFile && containsTest;
  });

  return matchingFolder || null;
}

// Load artifact folder list dynamically (called after data load)
async function loadArtifactFolders() {
  try {
    // In a real implementation, this would fetch a directory listing
    // For now, we extract from testSummary if available
    if (testSummary?.failures) {
      testSummary.failures.forEach((f) => {
        if (f.artifactFolder && !knownArtifactFolders.includes(f.artifactFolder)) {
          knownArtifactFolders.push(f.artifactFolder);
        }
      });
    }
  } catch (error) {
    console.warn('Could not load artifact folders:', error);
  }
}

// Generate AI fix for a test
async function generateAIFix(testId) {
  const test = allTestsData.find((t) => t.id === testId);
  if (!test) return;

  // Show modal
  const modal = document.getElementById('aiFixModal');
  modal.style.display = 'block';

  // Populate modal with test info
  document.getElementById('modalTestName').textContent = test.name;
  document.getElementById('modalTestFile').textContent = `File: ${test.file}`;
  document.getElementById('modalTestCategory').textContent =
    `Suite: ${test.suite || test.category || 'N/A'}`;
  document.getElementById('modalErrorMessage').textContent =
    test.error || 'No error message available';

  // Populate artifacts
  const artifactsDiv = document.getElementById('modalArtifacts');
  artifactsDiv.innerHTML = renderArtifactItems(test);

  // Show loading state
  const aiFix = document.getElementById('aiFix');
  aiFix.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Generating AI-powered fix suggestion...</p>
        </div>
    `;

  // Simulate AI fix generation (replace with actual API call)
  setTimeout(() => {
    const fixSuggestion = generateMockAIFix(test);
    aiFix.innerHTML = `<pre>${escapeHtml(fixSuggestion)}</pre>`;
  }, 2000);
}

// Generate all AI fixes
async function generateAllFixes() {
  const failedTests = allTestsData.filter((t) => t.status === 'failed');

  if (failedTests.length === 0) {
    alert('No failed tests to fix!');
    return;
  }

  const confirmed = confirm(`Generate AI fixes for ${failedTests.length} failed test(s)?`);
  if (!confirmed) return;

  // Show progress
  showLoading();

  // Simulate batch processing
  for (let i = 0; i < failedTests.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  hideLoading();
  alert(
    `Successfully generated AI fixes for ${failedTests.length} test(s)! Check the test-results/fixes/ directory.`
  );
}

// Analyze flaky tests
function analyzeFlakyTests() {
  if (flakyTestsData.length === 0) {
    alert('No flaky tests detected!');
    return;
  }

  const modal = document.getElementById('flakyModal');
  modal.style.display = 'block';

  // Generate analysis summary
  const summary = `
        <p><strong>Total Flaky Tests:</strong> ${flakyTestsData.length}</p>
        <p><strong>Average Retry Count:</strong> ${calculateAverageRetries()}</p>
        <p><strong>Most Common Pattern:</strong> ${identifyMostCommonPattern()}</p>
    `;
  document.getElementById('flakySummary').innerHTML = summary;

  // Identify patterns
  const patterns = `
        <div class="pattern-item">
            <strong><i class="fas fa-clock"></i> Timing Issues:</strong> ${countPattern('timing')} test(s) show timing-related failures
        </div>
        <div class="pattern-item">
            <strong><i class="fas fa-network-wired"></i> Network Issues:</strong> ${countPattern('network')} test(s) have network-related failures
        </div>
        <div class="pattern-item">
            <strong><i class="fas fa-mouse-pointer"></i> Selector Issues:</strong> ${countPattern('selector')} test(s) have element selector problems
        </div>
    `;
  document.getElementById('flakyPatterns').innerHTML = patterns;

  // Generate recommendations
  const recommendations = `
        <div class="recommendation-item">
            <strong>1. Increase Timeouts:</strong> Add explicit waits for elements and network requests
        </div>
        <div class="recommendation-item">
            <strong>2. Use Stable Selectors:</strong> Replace flaky selectors with more robust alternatives
        </div>
        <div class="recommendation-item">
            <strong>3. Add Retry Logic:</strong> Implement smart retry mechanisms for transient failures
        </div>
        <div class="recommendation-item">
            <strong>4. Mock External Dependencies:</strong> Reduce reliance on external services
        </div>
    `;
  document.getElementById('flakyRecommendations').innerHTML = recommendations;
}

// Generate flaky fixes
async function generateFlakyFixes() {
  if (flakyTestsData.length === 0) {
    alert('No flaky tests to fix!');
    return;
  }

  const confirmed = confirm(`Generate stability fixes for ${flakyTestsData.length} flaky test(s)?`);
  if (!confirmed) return;

  showLoading();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  hideLoading();

  alert(`Successfully generated stability fixes for ${flakyTestsData.length} flaky test(s)!`);
}

// View test artifacts
function viewArtifacts(testId) {
  const test = allTestsData.find((t) => t.id === testId);
  if (!test) {
    alert('Test not found');
    return;
  }

  // Show modal with artifacts
  const modal = document.getElementById('aiFixModal');
  modal.style.display = 'block';

  document.getElementById('modalTestName').textContent = `Artifacts: ${test.name}`;
  document.getElementById('modalTestFile').textContent = `File: ${test.file}`;
  document.getElementById('modalTestCategory').textContent = `Suite: ${test.suite || 'N/A'}`;
  document.getElementById('modalErrorMessage').textContent = test.error || 'No error details';

  const aiFix = document.getElementById('aiFix');
  const artifactFolder = findArtifactFolder(test);

  if (artifactFolder) {
    const basePath = `${ARTIFACTS_PATH}/${artifactFolder}`;
    aiFix.innerHTML = `
            <div class="artifacts-preview">
                <h4><i class="fas fa-folder-open"></i> Available Artifacts</h4>
                <div class="artifact-preview-grid">
                    <div class="artifact-preview-item">
                        <h5><i class="fas fa-camera"></i> Screenshot</h5>
                        <a href="${basePath}/test-failed-1.png" target="_blank">
                            <img src="${basePath}/test-failed-1.png" alt="Test Screenshot" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                            <span style="display:none; color: #999;">Screenshot not available</span>
                        </a>
                    </div>
                    <div class="artifact-preview-item">
                        <h5><i class="fas fa-video"></i> Video Recording</h5>
                        <video controls style="max-width: 100%; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                            <source src="${basePath}/video.webm" type="video/webm">
                            Your browser does not support video playback.
                        </video>
                        <span style="display:none; color: #999;">Video not available</span>
                    </div>
                </div>
                <div class="trace-download" style="margin-top: 20px; padding: 15px; background: #f0f7ff; border-radius: 8px;">
                    <h5><i class="fas fa-search"></i> Trace File</h5>
                    <p>Open <a href="https://trace.playwright.dev/" target="_blank">trace.playwright.dev</a> and drag the trace file to analyze:</p>
                    <a href="${basePath}/trace.zip" download class="btn btn-primary" style="margin-top: 10px;">
                        <i class="fas fa-download"></i> Download trace.zip
                    </a>
                </div>
            </div>
        `;
  } else {
    aiFix.innerHTML = '<p class="no-artifacts">No artifacts available for this test.</p>';
  }

  // Populate artifacts section
  const artifactsDiv = document.getElementById('modalArtifacts');
  artifactsDiv.innerHTML = renderArtifactItems(test);
}

// View flaky test details
function viewFlakyDetails(testId) {
  generateAIFix(testId); // Reuse the modal
}

// Filter tests - works with Playwright-style test list
function filterTests() {
  const searchInput = document.getElementById('testSearchInput');
  const statusFilterEl = document.getElementById('statusFilter');

  if (!searchInput || !statusFilterEl) {
    console.error('Filter elements not found');
    return;
  }

  const searchTerm = searchInput.value.toLowerCase();
  const statusFilter = statusFilterEl.value;

  // Filter based on search and status
  const filteredData = allTestsData.filter((test) => {
    const testName = (test.name || '').toLowerCase();
    const testSuite = (test.suite || '').toLowerCase();
    const testFile = (test.file || '').toLowerCase();

    const matchesSearch =
      !searchTerm ||
      testName.includes(searchTerm) ||
      testSuite.includes(searchTerm) ||
      testFile.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || test.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Re-render the test list with filtered data
  renderFilteredTestList(filteredData);
}

// Render filtered test list
function renderFilteredTestList(filteredTests) {
  const gridDiv = document.querySelector('#allTestsGrid');

  // Group filtered tests by suite
  const testsBySuite = {};
  filteredTests.forEach((test) => {
    const suite = test.suite || 'Other Tests';
    if (!testsBySuite[suite]) {
      testsBySuite[suite] = [];
    }
    testsBySuite[suite].push(test);
  });

  // Create HTML structure similar to Playwright HTML report
  let html = '<div class="pw-test-list">';

  if (Object.keys(testsBySuite).length === 0) {
    html +=
      '<div class="pw-empty-state"><i class="fas fa-search"></i><p>No tests match your filter criteria</p></div>';
  } else {
    for (const [suiteName, tests] of Object.entries(testsBySuite)) {
      // Calculate suite stats
      const passed = tests.filter((t) => t.status === 'passed').length;
      const failed = tests.filter((t) => t.status === 'failed').length;
      const skipped = tests.filter((t) => t.status === 'skipped').length;
      const flaky = tests.filter((t) => t.status === 'flaky').length;
      const totalDuration = tests.reduce((sum, t) => sum + (t.duration || 0), 0);

      html += `
            <div class="pw-suite">
                <div class="pw-suite-header" onclick="toggleSuite(this)">
                    <span class="pw-suite-toggle"><i class="fas fa-chevron-down"></i></span>
                    <span class="pw-suite-icon"><i class="fas fa-folder"></i></span>
                    <span class="pw-suite-name">${escapeHtml(suiteName)}</span>
                    <span class="pw-suite-stats">
                        ${passed > 0 ? `<span class="pw-stat pw-stat-passed">${passed}</span>` : ''}
                        ${failed > 0 ? `<span class="pw-stat pw-stat-failed">${failed}</span>` : ''}
                        ${flaky > 0 ? `<span class="pw-stat pw-stat-flaky">${flaky}</span>` : ''}
                        ${skipped > 0 ? `<span class="pw-stat pw-stat-skipped">${skipped}</span>` : ''}
                    </span>
                    <span class="pw-suite-duration">${formatDuration(totalDuration)}</span>
                </div>
                <div class="pw-suite-tests">
        `;

      tests.forEach((test) => {
        const statusIcon = getStatusIcon(test.status);
        const statusClass = `pw-test-${test.status}`;
        const hasArtifacts = test.status === 'failed' || test.status === 'flaky';

        html += `
                <div class="pw-test ${statusClass}" data-test-id="${escapeHtml(test.id)}">
                    <span class="pw-test-status">${statusIcon}</span>
                    <span class="pw-test-name">${escapeHtml(test.name)}</span>
                    <span class="pw-test-duration">${formatDuration(test.duration)}</span>
                    ${
                      hasArtifacts
                        ? `
                        <span class="pw-test-actions">
                            <button class="pw-action-btn" onclick="viewArtifacts('${escapeHtml(test.id)}')" title="View Artifacts">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <button class="pw-action-btn" onclick="openTraceViewer('${escapeHtml(test.id)}')" title="View Trace">
                                <i class="fas fa-search"></i>
                            </button>
                        </span>
                    `
                        : ''
                    }
                </div>
            `;
      });

      html += `
                </div>
            </div>
        `;
    }
  }

  html += '</div>';
  gridDiv.innerHTML = html;
}

// Export report
function exportReport() {
  const data = {
    summary: testSummary,
    failures: testFailures,
    stats: calculateStats(),
    exportDate: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Copy fix to clipboard
function copyFixToClipboard() {
  const fixContent = document.querySelector('#aiFix pre');
  if (!fixContent) return;

  navigator.clipboard.writeText(fixContent.textContent).then(() => {
    alert('Fix copied to clipboard!');
  });
}

// Create pull request
function createPullRequest() {
  alert(
    'Creating pull request with AI-generated fix...\n\nThis will:\n1. Create a topic branch\n2. Commit the fix\n3. Push to remote\n4. Open a draft PR'
  );

  // In real implementation, this would call the PR provider API
  setTimeout(() => {
    alert(
      'Pull request created successfully!\n\nPR #123: https://github.com/yourorg/yourrepo/pull/123'
    );
    closeAIModal();
  }, 1000);
}

// Modal controls
function closeAIModal() {
  document.getElementById('aiFixModal').style.display = 'none';
}

function closeFlakyModal() {
  document.getElementById('flakyModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function (event) {
  const aiModal = document.getElementById('aiFixModal');
  const flakyModal = document.getElementById('flakyModal');

  if (event.target === aiModal) {
    closeAIModal();
  }
  if (event.target === flakyModal) {
    closeFlakyModal();
  }
};

// Helper functions
function formatDuration(ms) {
  if (!ms) return '0s';
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

function truncateString(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

function generateId() {
  return 'test-' + Math.random().toString(36).substr(2, 9);
}

function calculateFailureRate(retryCount) {
  return Math.min(Math.round((retryCount / 3) * 100), 100);
}

function identifyFlakyPattern(failure) {
  const error = (failure.errorMessage || '').toLowerCase();
  if (error.includes('timeout')) return 'Timing Issues';
  if (error.includes('network') || error.includes('request')) return 'Network Issues';
  if (error.includes('selector') || error.includes('element')) return 'Selector Issues';
  return 'Intermittent Failure';
}

function calculateAverageRetries() {
  if (flakyTestsData.length === 0) return 0;
  const total = flakyTestsData.reduce((sum, t) => sum + t.retries, 0);
  return (total / flakyTestsData.length).toFixed(1);
}

function identifyMostCommonPattern() {
  const patterns = {};
  flakyTestsData.forEach((t) => {
    patterns[t.pattern] = (patterns[t.pattern] || 0) + 1;
  });

  let maxPattern = 'None';
  let maxCount = 0;
  for (const [pattern, count] of Object.entries(patterns)) {
    if (count > maxCount) {
      maxCount = count;
      maxPattern = pattern;
    }
  }
  return maxPattern;
}

function countPattern(type) {
  return flakyTestsData.filter((t) => t.pattern.toLowerCase().includes(type)).length;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderArtifactLinks(test) {
  // Check if test has failed and might have artifacts
  if (test.status !== 'failed' && test.status !== 'flaky') {
    return '<span class="no-artifacts">-</span>';
  }

  const artifactFolder = findArtifactFolder(test);
  if (!artifactFolder) {
    return '<span class="no-artifacts">No artifacts</span>';
  }

  const basePath = `${ARTIFACTS_PATH}/${artifactFolder}`;
  let html = '<div class="artifact-links">';

  // Screenshot link
  html += `<a href="${basePath}/test-failed-1.png" target="_blank" class="artifact-link" title="View Screenshot">
        <i class="fas fa-camera"></i>
    </a>`;

  // Video link
  html += `<a href="${basePath}/video.webm" target="_blank" class="artifact-link" title="View Video">
        <i class="fas fa-video"></i>
    </a>`;

  // Trace link - opens trace.playwright.dev instructions
  html += `<a href="javascript:void(0)" onclick="openTraceViewer('${escapeHtml(test.id)}')" class="artifact-link" title="Open Trace Viewer">
        <i class="fas fa-search"></i>
    </a>`;

  html += '</div>';
  return html;
}

function renderArtifactItems(test) {
  const artifactFolder = findArtifactFolder(test);

  if (!artifactFolder) {
    return '<p class="no-artifacts">No artifacts available for this test.</p>';
  }

  const basePath = `${ARTIFACTS_PATH}/${artifactFolder}`;
  let html = '<div class="artifacts-grid">';

  // Screenshot
  html += `
        <div class="artifact-item">
            <i class="fas fa-camera"></i>
            <a href="${basePath}/test-failed-1.png" target="_blank">View Screenshot</a>
        </div>
    `;

  // Video
  html += `
        <div class="artifact-item">
            <i class="fas fa-video"></i>
            <a href="${basePath}/video.webm" target="_blank">View Video Recording</a>
        </div>
    `;

  // Trace
  html += `
        <div class="artifact-item">
            <i class="fas fa-search"></i>
            <a href="https://trace.playwright.dev/" target="_blank">Open Trace Viewer</a>
            <small>(drag trace.zip file)</small>
        </div>
    `;

  // Download trace
  html += `
        <div class="artifact-item">
            <i class="fas fa-download"></i>
            <a href="${basePath}/trace.zip" download>Download trace.zip</a>
        </div>
    `;

  // Error context
  html += `
        <div class="artifact-item">
            <i class="fas fa-file-alt"></i>
            <a href="${basePath}/error-context.md" target="_blank">View Error Context</a>
        </div>
    `;

  html += '</div>';
  return html;
}

function generateMockAIFix(test) {
  const errorMsg = test.error || 'Unknown error';
  const stackTrace = test.stackTrace || '';

  return `// AI-Generated Fix Suggestion for: ${test.name}

// Issue: ${test.suite || 'Unknown Suite'} - ${errorMsg}

// Error Stack:
${stackTrace.split('\n').slice(0, 5).join('\n')}

// Recommended Fix:
${generateFixBasedOnCategory(test.category, test)}

// Additional Recommendations:
// 1. Add proper wait conditions before interacting with elements
// 2. Use more specific and stable selectors
// 3. Add error handling for network requests
// 4. Consider adding retry logic for flaky operations

// Implementation Steps:
// 1. Update the test file: ${test.file}
// 2. Apply the suggested changes
// 3. Run the test locally to verify
// 4. Create a PR with the fix

// Generated by Playwright AI Reporter
// Timestamp: ${new Date().toISOString()}`;
}

function generateFixBasedOnCategory(category, test) {
  switch (category) {
    case 'TimeoutError':
      return `// Increase timeout and add explicit wait
await page.waitForSelector('your-selector', {
    state: 'visible',
    timeout: 30000
});
await page.click('your-selector');`;

    case 'SelectorError':
      return `// Use more robust selector
// Before: await page.click('.button')
// After:
await page.click('[data-testid="submit-button"]');
// or
await page.click('button:has-text("Submit")');`;

    case 'NetworkError':
      return `// Add network wait and error handling
await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/endpoint')),
    page.click('button')
]);`;

    case 'AssertionError':
      return `// Add proper wait before assertion
await page.waitForSelector('.result');
const text = await page.textContent('.result');
expect(text).toBe('Expected Value');`;

    default:
      return `// General improvement suggestions
// 1. Add explicit waits
await page.waitForLoadState('networkidle');

// 2. Use stable selectors
await page.click('[data-testid="element"]');

// 3. Add error handling
try {
    await page.click('button');
} catch (error) {
    console.error('Failed to click button:', error);
    throw error;
}`;
  }
}

function generateTrendData() {
  const stats = calculateStats();
  const runs = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const variation = Math.random() * 0.3 - 0.15; // ±15% variation

    runs.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      passed: Math.max(0, Math.round(stats.passed * (1 + variation))),
      failed: Math.max(0, Math.round(stats.failed * (1 + variation))),
    });
  }

  return runs;
}

function showLoading() {
  // Could add a loading overlay
  console.log('Loading...');
}

function hideLoading() {
  console.log('Loading complete');
}

function showError(message) {
  console.error(message);
  alert(message);
}

// Generate sample data for demo purposes
function generateSampleSummary() {
  return {
    environment: 'CI/CD Pipeline',
    buildInfo: 'Build #42 - main branch',
    timestamp: new Date().toISOString(),
    totalTests: 50,
    passed: 42,
    failed: 5,
    skipped: 3,
    duration: 125000,
    testResults: Array.from({ length: 50 }, (_, i) => ({
      testId: `test-${i}`,
      testName: `Sample Test ${i + 1}`,
      testFile: `tests/sample-${Math.floor(i / 10)}.spec.ts`,
      status: i < 42 ? 'passed' : i < 47 ? 'failed' : 'skipped',
      duration: Math.random() * 5000 + 1000,
      timestamp: new Date().toISOString(),
    })),
  };
}

function generateSampleFailures() {
  return {
    failures: [
      {
        testId: 'test-42',
        testName: 'Login with invalid credentials',
        testFile: 'tests/auth.spec.ts',
        errorMessage: 'TimeoutError: Waiting for selector ".error-message" failed',
        stackTrace: 'at Page.waitForSelector (...)',
        category: 'TimeoutError',
        duration: 30000,
        retryCount: 0,
        artifacts: {
          screenshot: './test-results/screenshots/login-failure.png',
          video: './test-results/videos/login-test.webm',
          trace: './test-results/traces/login-trace.zip',
        },
        timestamp: new Date().toISOString(),
      },
      {
        testId: 'test-43',
        testName: 'API endpoint returns correct data',
        testFile: 'tests/api.spec.ts',
        errorMessage: 'NetworkError: Request failed with status 500',
        stackTrace: 'at APIRequestContext.fetch (...)',
        category: 'NetworkError',
        duration: 2500,
        retryCount: 2,
        artifacts: {
          screenshot: './test-results/screenshots/api-failure.png',
        },
        timestamp: new Date().toISOString(),
      },
      {
        testId: 'test-44',
        testName: 'Shopping cart updates correctly',
        testFile: 'tests/cart.spec.ts',
        errorMessage: 'SelectorError: Element not found: [data-testid="cart-item"]',
        stackTrace: 'at Page.click (...)',
        category: 'SelectorError',
        duration: 3200,
        retryCount: 1,
        artifacts: {
          screenshot: './test-results/screenshots/cart-failure.png',
          video: './test-results/videos/cart-test.webm',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
