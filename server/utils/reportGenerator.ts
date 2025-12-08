import { FlowRun, TaskState, TaskRun } from '../types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a static HTML report for a completed flow run
 */
export function generateFlowReport(run: FlowRun, clientName: string = 'default'): void {
  try {
    // Create Reports directory structure
    const reportsDir = path.join(__dirname, '../../Reports', clientName);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate filename with tags and timestamp
    const timestamp = new Date(run.startTime).toISOString().replace(/[:.]/g, '-');
    const flowNamePart = run.flowName.replace(/\s+/g, '_');

    // Format tags for filename
    let tagsPart = '';
    if (run.tags && Object.keys(run.tags).length > 0) {
      tagsPart = '_' + Object.entries(run.tags)
        .map(([key, value]) => `${key}-${value}`)
        .join('_');
    }

    const filename = `${flowNamePart}${tagsPart}_${timestamp}.html`;
    const filePath = path.join(reportsDir, filename);

    // Generate HTML content
    const html = generateReportHTML(run, clientName);

    // Write to file
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`[ReportGenerator] Generated report: ${filePath}`);
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate report:', error);
  }
}

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate total duration of a flow run
 */
function calculateTotalDuration(run: FlowRun): number {
  if (!run.endTime) return 0;
  return new Date(run.endTime).getTime() - new Date(run.startTime).getTime();
}

/**
 * Get status badge color
 */
function getStatusColor(state: TaskState): string {
  switch (state) {
    case TaskState.COMPLETED:
      return '#10b981'; // green
    case TaskState.FAILED:
      return '#ef4444'; // red
    case TaskState.RUNNING:
      return '#3b82f6'; // blue
    case TaskState.PENDING:
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

/**
 * Generate the complete HTML report
 */
function generateReportHTML(run: FlowRun, clientName: string): string {
  const totalDuration = calculateTotalDuration(run);
  const successCount = run.tasks.filter(t => t.state === TaskState.COMPLETED).length;
  const failedCount = run.tasks.filter(t => t.state === TaskState.FAILED).length;
  const passRate = run.tasks.length > 0 ? (successCount / run.tasks.length * 100).toFixed(1) : '0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flow Report: ${run.flowName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #e2e8f0;
      padding: 2rem;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #ffffff;
    }

    .header .subtitle {
      color: #94a3b8;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .status-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .stat-card .label {
      color: #94a3b8;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .stat-card .value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
    }

    .section {
      background: rgba(30, 41, 59, 0.3);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #ffffff;
      border-bottom: 2px solid #334155;
      padding-bottom: 0.5rem;
    }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .task-card {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1rem;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .task-name {
      font-weight: 600;
      font-size: 1rem;
      color: #ffffff;
    }

    .task-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }

    .task-meta span {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #1e293b;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
      transition: width 0.3s ease;
    }

    .logs {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 1rem;
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      color: #cbd5e1;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 0.75rem;
    }

    .logs .log-line {
      margin-bottom: 0.25rem;
      line-height: 1.5;
    }

    .result-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.75rem;
    }

    .result-table th,
    .result-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #334155;
    }

    .result-table th {
      background: #1e293b;
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .result-table td {
      color: #e2e8f0;
      font-size: 0.875rem;
    }

    .tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
      border: 1px solid rgba(56, 189, 248, 0.5);
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: 'Courier New', monospace;
      margin-right: 0.5rem;
    }

    .tag-key {
      color: #38bdf8;
      font-weight: 600;
    }

    .tag-value {
      color: #ffffff;
    }

    .footer {
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #334155;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${run.flowName}</h1>
      <div class="subtitle">
        Client: ${clientName} | Run ID: ${run.id} | Configuration: ${run.configuration || 'default'}
      </div>
      ${run.tags ? Object.entries(run.tags).map(([key, value]) =>
        `<span class="tag-badge"><span class="tag-key">${key}:</span> <span class="tag-value">${value}</span></span>`
      ).join('') : ''}
      <div style="margin-top: 1rem;">
        <span class="status-badge" style="background-color: ${getStatusColor(run.state)}; color: white;">
          ${run.state}
        </span>
      </div>
    </div>

    <!-- Statistics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Duration</div>
        <div class="value">${formatDuration(totalDuration)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Progress</div>
        <div class="value">${run.progress}%</div>
      </div>
      <div class="stat-card">
        <div class="label">Tasks Completed</div>
        <div class="value" style="color: #10b981;">${successCount} / ${run.tasks.length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Tasks Failed</div>
        <div class="value" style="color: ${failedCount > 0 ? '#ef4444' : '#64748b'};">${failedCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Pass Rate</div>
        <div class="value">${passRate}%</div>
      </div>
      <div class="stat-card">
        <div class="label">Start Time</div>
        <div class="value" style="font-size: 1rem;">${new Date(run.startTime).toLocaleString()}</div>
      </div>
    </div>

    <!-- Flow Logs -->
    ${run.logs && run.logs.length > 0 ? `
    <div class="section">
      <h2>Flow Logs</h2>
      <div class="logs">
        ${run.logs.map(log => `<div class="log-line">${log}</div>`).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Tasks -->
    <div class="section">
      <h2>Tasks (${run.tasks.length})</h2>
      <div class="task-list">
        ${run.tasks.map(task => generateTaskHTML(task)).join('')}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Report generated by Perfect Flow Engine</p>
      <p>Generated at: ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML for a single task
 */
function generateTaskHTML(task: TaskRun): string {
  const duration = task.durationMs ? formatDuration(task.durationMs) : 'N/A';
  const startTime = task.startTime ? new Date(task.startTime).toLocaleTimeString() : 'Not started';
  const endTime = task.endTime ? new Date(task.endTime).toLocaleTimeString() : 'Not finished';

  return `
    <div class="task-card">
      <div class="task-header">
        <span class="task-name">${task.taskName}</span>
        <span class="status-badge" style="background-color: ${getStatusColor(task.state)}; color: white; font-size: 0.75rem; padding: 0.25rem 0.75rem;">
          ${task.state}
        </span>
      </div>

      <div class="task-meta">
        <span>⏱️ Duration: ${duration}</span>
        <span>🚀 Started: ${startTime}</span>
        <span>✅ Ended: ${endTime}</span>
        <span>⚖️ Weight: ${(task.weight * 100).toFixed(1)}%</span>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width: ${task.progress}%; background: ${task.state === TaskState.FAILED ? '#ef4444' : 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)'}"></div>
      </div>

      ${task.result ? `
        <div style="margin-top: 0.75rem;">
          <strong style="color: ${task.result.passed ? '#10b981' : '#ef4444'};">
            ${task.result.passed ? '✓ Passed' : '✗ Failed'}
          </strong>
          ${task.result.note ? `<div style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem;">${task.result.note}</div>` : ''}
          ${task.result.table && task.result.table.length > 0 ? `
            <table class="result-table">
              <thead>
                <tr>
                  ${Object.keys(task.result.table[0]).map(key => `<th>${key}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${task.result.table.map(row => `
                  <tr>
                    ${Object.values(row).map(value => `<td>${value}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
      ` : ''}

      ${task.logs && task.logs.length > 0 ? `
        <div class="logs">
          ${task.logs.map(log => `<div class="log-line">${log}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
