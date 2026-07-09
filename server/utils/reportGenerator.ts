import { FlowRun, TaskState, TaskRun } from '../types';
import { REPORT_STYLES } from './reportStyles';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a static HTML report for a completed flow run
 * @returns The relative path to the report (e.g., "Reports/FlowName/flow_timestamp.html")
 */
export function generateFlowReport(run: FlowRun, clientName: string = 'default'): string | null {
  try {
    // Create Reports directory structure organized by flow name
    const flowNameForDir = run.flowName.replace(/\s+/g, '_');
    const reportsDir = path.join(__dirname, '../../Reports', flowNameForDir);
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

    // Return relative path for accessing via web server
    return `Reports/${flowNameForDir}/${filename}`;
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate report:', error);
    return null;
  }
}

/**
 * Format a duration for HTML reports, using a human-readable "1m 30s" form for
 * durations of a minute or more. NOTE: the frontend has its own formatDuration
 * in `src/utils/formatUtils.ts` that intentionally uses a compact decimal form
 * ("1.50m") better suited to chart/stat labels — the two are deliberately
 * different presentations and are not shared.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate total duration of a flow run
 */
export function calculateTotalDuration(run: FlowRun): number {
  if (!run.endTime) return 0;
  return new Date(run.endTime).getTime() - new Date(run.startTime).getTime();
}

/**
 * Get status badge color
 */
export function getStatusColor(state: TaskState): string {
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
export function generateReportHTML(run: FlowRun, clientName: string): string {
  const totalDuration = calculateTotalDuration(run);
  const successCount = run.tasks.filter(t => t.state === TaskState.COMPLETED).length;
  const failedCount = run.tasks.filter(t => t.state === TaskState.FAILED).length;
  const passRate = run.tasks.length > 0 ? (successCount / run.tasks.length * 100).toFixed(1) : '0';
  const warningCount = run.tasks.filter(t => t.performanceWarning && t.performanceWarning.severity === 'warning').length;
  const criticalCount = run.tasks.filter(t => t.performanceWarning && t.performanceWarning.severity === 'critical').length;
  const hasWarnings = warningCount > 0 || criticalCount > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flow Report: ${run.flowName}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${run.flowName}</h1>
      <div class="subtitle">
        Client: ${clientName} | Run ID: ${run.id}
      </div>
      ${run.tags ? Object.entries(run.tags).map(([key, value]) =>
        `<span class="tag-badge"><span class="tag-key">${key}:</span> <span class="tag-value">${value}</span></span>`
      ).join('') : ''}
      <div style="margin-top: 1rem; display: flex; gap: 0.5rem; align-items: center;">
        <span class="status-badge" style="background-color: ${getStatusColor(run.state)}; color: white;">
          ${run.state}
        </span>
        ${hasWarnings ? `
        <span class="status-badge" style="background-color: ${criticalCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)'}; color: ${criticalCount > 0 ? '#fca5a5' : '#fcd34d'}; border: 1px solid ${criticalCount > 0 ? '#ef4444' : '#f59e0b'};">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          ${criticalCount > 0 ? 'CRITICAL' : 'SLOW'}
        </span>
        ` : ''}
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
      ${hasWarnings ? `
      <div class="stat-card" style="border-color: ${criticalCount > 0 ? '#ef4444' : '#f59e0b'};">
        <div class="label" style="color: ${criticalCount > 0 ? '#fca5a5' : '#fcd34d'};">Performance Issues</div>
        <div class="value" style="color: ${criticalCount > 0 ? '#ef4444' : '#f59e0b'};">
          ${criticalCount > 0 ? `${criticalCount} Critical` : ''}
          ${criticalCount > 0 && warningCount > 0 ? ', ' : ''}
          ${warningCount > 0 ? `${warningCount} Warning${warningCount !== 1 ? 's' : ''}` : ''}
        </div>
      </div>
      ` : ''}
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
 * Recursively render a value for the report table
 */
export function renderValue(value: any, depth: number = 0): string {
  if (value === null || value === undefined) {
    return '<span style="color: #64748b; font-style: italic;">null</span>';
  }

  if (typeof value === 'boolean') {
    return `<span style="color: ${value ? '#10b981' : '#ef4444'};">${value ? '✓ true' : '✗ false'}</span>`;
  }

  if (typeof value === 'number') {
    return `<span class="nested-value number">${value.toLocaleString()}</span>`;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '<span style="color: #64748b; font-style: italic;">{}</span>';
    }

    const rows = entries.map(([k, v]) => {
      const renderedValue = renderValue(v, depth + 1);
      return `
        <div class="nested-row">
          <span class="nested-key">${k}:</span>
          <span>${renderedValue}</span>
        </div>
      `;
    }).join('');

    return `<div class="nested-object${depth > 0 ? ' deep-nested' : ''}">${rows}</div>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<span style="color: #64748b; font-style: italic;">[]</span>';
    }
    const items = value.map((item, i) => {
      const renderedItem = renderValue(item, depth + 1);
      return `<div class="nested-row"><span class="nested-key">[${i}]</span><span>${renderedItem}</span></div>`;
    }).join('');
    return `<div class="nested-object${depth > 0 ? ' deep-nested' : ''}">${items}</div>`;
  }

  return `<span class="nested-value string">${String(value)}</span>`;
}

/**
 * Generate HTML for a single task
 */
export function generateTaskHTML(task: TaskRun): string {
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

      ${task.performanceWarning ? `
        <div style="margin-top: 0.75rem; padding: 0.75rem; background: ${task.performanceWarning.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)'}; border: 1px solid ${task.performanceWarning.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(251, 191, 36, 0.3)'}; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: ${task.performanceWarning.severity === 'critical' ? '#fca5a5' : '#fcd34d'};">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <strong>${task.performanceWarning.severity === 'critical' ? 'Critical Performance Issue' : 'Performance Warning'}</strong>
            <span style="color: ${task.performanceWarning.severity === 'critical' ? '#fecaca' : '#fde68a'};">• ${task.performanceWarning.message}</span>
          </div>
        </div>
      ` : ''}

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
                    ${Object.values(row).map(value => `<td>${renderValue(value)}</td>`).join('')}
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
