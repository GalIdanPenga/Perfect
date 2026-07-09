// Static CSS for the generated HTML flow reports. Extracted from
// reportGenerator.ts to keep that module focused on report structure/data.
export const REPORT_STYLES = `
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
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 0.75rem;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #334155;
    }

    .result-table th,
    .result-table td {
      padding: 1rem 1.25rem;
      text-align: left;
    }

    .result-table th {
      background: #1e293b;
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #475569;
    }

    .result-table td {
      color: #e2e8f0;
      font-size: 0.875rem;
      vertical-align: top;
      border-bottom: 2px solid #334155;
    }

    .result-table tr:last-child td {
      border-bottom: none;
    }

    .result-table tbody tr:nth-child(odd) {
      background: rgba(15, 23, 42, 0.3);
    }

    .result-table tbody tr:nth-child(even) {
      background: rgba(30, 41, 59, 0.3);
    }

    .result-table tbody tr:hover {
      background: rgba(56, 189, 248, 0.1);
    }

    .nested-object {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nested-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 4px 8px;
      background: rgba(30, 41, 59, 0.5);
      border-radius: 4px;
      border-left: 2px solid #475569;
    }

    .nested-key {
      color: #94a3b8;
      font-weight: 500;
      white-space: nowrap;
    }

    .nested-value {
      color: #e2e8f0;
    }

    .nested-value.number {
      color: #38bdf8;
    }

    .nested-value.string {
      color: #a78bfa;
    }

    .deep-nested {
      margin-left: 12px;
      padding-left: 8px;
      border-left: 1px solid #475569;
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
`;
