import React, { useState } from 'react';
import { SchedulePlan, ZoneState, DisruptionEvent } from '../types';
import { FACILITY_ZONES } from '../data/facility';
import { FLEET_ROSTER } from '../data/roster';
import { FileText, Printer, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, ShieldCheck, Droplet, ExternalLink, X, Eye } from 'lucide-react';

interface ShiftReportViewProps {
  schedulePlan: SchedulePlan;
  zoneStates: Map<string, ZoneState>;
  disruptions: DisruptionEvent[];
  timeDisplay: string;
}

export const ShiftReportView: React.FC<ShiftReportViewProps> = ({
  schedulePlan,
  zoneStates,
  disruptions,
  timeDisplay
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const completedZones = (Array.from(zoneStates.values()) as ZoneState[]).filter(z => z.status === 'completed').length;
  const totalZones = FACILITY_ZONES.length;
  const slaCompliancePct = Math.round((completedZones / totalZones) * 100);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const generateCSV = () => {
    const headers = ['Zone ID', 'Zone Name', 'Area (Sq Ft)', 'Floor Type', 'Classification', 'Cleaning Window', 'Assigned Robot', 'Status'];
    const rows = FACILITY_ZONES.map(zone => {
      const zState = zoneStates.get(zone.id);
      const assignedTask = schedulePlan.tasks.find(t => t.zoneId === zone.id);
      return [
        zone.id,
        `"${zone.name}"`,
        zone.sqFt,
        `"${zone.floorType}"`,
        `"${zone.classification}"`,
        `"${zone.cleaningWindowStart} - ${zone.cleaningWindowEnd}"`,
        assignedTask ? assignedTask.robotId : 'UNASSIGNED',
        zState?.status.toUpperCase() || 'PENDING'
      ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  };

  const handleDownloadCSV = () => {
    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hospital_shift_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✓ Shift audit CSV spreadsheet downloaded successfully!');
  };

  const generateFormattedTextReport = () => {
    let report = `=================================================================\n`;
    report += ` REGIONAL GENERAL HOSPITAL - FACILITY MANAGER SHIFT AUDIT REPORT\n`;
    report += ` Tuesday Night Shift (7:00 PM – 7:00 AM) • Generated: ${timeDisplay}\n`;
    report += `=================================================================\n\n`;
    report += `KPI OVERVIEW:\n`;
    report += `- SLA Compliance Index: ${slaCompliancePct}% (${completedZones}/${totalZones} Zones Completed)\n`;
    report += `- Total Sq Ft Cleaned: ${schedulePlan.estimatedTotalSqFtCleaned.toLocaleString()} sq ft\n`;
    report += `- Water Refills Completed: 12 Refills (10-Min Dump & Refill Cycles)\n`;
    report += `- Disruptions / Escalations: ${disruptions.length} Events\n\n`;
    report += `ZONE-BY-ZONE CLEANING AUDIT:\n`;
    report += `-----------------------------------------------------------------\n`;
    report += `ID   | Zone Name                | Sq Ft  | Classification | Robot    | Status\n`;
    report += `-----------------------------------------------------------------\n`;
    FACILITY_ZONES.forEach(zone => {
      const zState = zoneStates.get(zone.id);
      const assignedTask = schedulePlan.tasks.find(t => t.zoneId === zone.id);
      const status = zState?.status.toUpperCase() || 'PENDING';
      const robot = assignedTask ? assignedTask.robotId : 'UNASSIGNED';
      report += `${zone.id.padEnd(4)} | ${zone.name.padEnd(24)} | ${zone.sqFt.toString().padEnd(6)} | ${zone.classification.padEnd(14)} | ${robot.padEnd(8)} | ${status}\n`;
    });
    report += `-----------------------------------------------------------------\n\n`;
    report += `CONSUMABLES & WATER AUDIT:\n`;
    report += `- Total Clean Water Consumed: 142.5 Gallons\n`;
    report += `- Wet Scrubbers Water Dump & Refill: 100% Executed\n`;
    report += `- Anomaly Audit: R-008 FloorBot FB-200 water leak risk score (82/100) flagged.\n\n`;
    report += `OEM FAULT & LOG SUMMARY:\n`;
    report += `- Disruptions logged: ${disruptions.length}\n`;
    disruptions.forEach((d, i) => {
      report += `  ${i+1}. [${d.timestamp}] ${d.robotId} (${d.oem}): ${d.description} - Action: ${d.resolutionAction}\n`;
    });
    report += `\n=================================================================\n`;
    report += ` END OF OFFICIAL SHIFT AUDIT REPORT\n`;
    report += `=================================================================\n`;
    return report;
  };

  const handleDownloadTextReport = () => {
    const textContent = generateFormattedTextReport();
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hospital_shift_audit_${new Date().toISOString().split('T')[0]}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✓ Official shift report text file downloaded successfully!');
  };

  const generatePrintableHTML = () => {
    const rowsHtml = FACILITY_ZONES.map(zone => {
      const zState = zoneStates.get(zone.id);
      const assignedTask = schedulePlan.tasks.find(t => t.zoneId === zone.id);
      const status = zState?.status.toUpperCase() || 'PENDING';
      const robot = assignedTask ? assignedTask.robotId : 'UNASSIGNED';
      const statusColor = status === 'COMPLETED' ? '#059669' : status === 'IN_PROGRESS' ? '#2563eb' : '#d97706';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold;">${zone.id}: ${zone.name}</td>
          <td style="padding: 10px; font-family: monospace;">${zone.sqFt.toLocaleString()} sq ft</td>
          <td style="padding: 10px;">${zone.floorType} &bull; ${zone.classification}</td>
          <td style="padding: 10px; font-family: monospace;">${zone.cleaningWindowStart} - ${zone.cleaningWindowEnd}</td>
          <td style="padding: 10px; font-family: monospace; font-weight: bold; color: #1e40af;">${robot}</td>
          <td style="padding: 10px;">
            <span style="background-color: ${statusColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${status}</span>
          </td>
        </tr>
      `;
    }).join('');

    const disruptionsHtml = disruptions.map((d, i) => `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 12px;">
        <strong>#${i+1} [${d.timestamp}] ${d.robotId} (${d.oem}):</strong> ${d.description}<br/>
        <span style="color: #0369a1;"><strong>Action Taken:</strong> ${d.resolutionAction}</span>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Hospital Shift Audit Report - ${timeDisplay}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 40px; background: #ffffff; line-height: 1.5; }
    .header { border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 22px; font-weight: 800; color: #065f46; margin: 0; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; }
    .kpi-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
    .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
    th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
    .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div className="no-print" style="margin-bottom: 20px; padding: 12px 18px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-size: 13px; font-weight: bold; color: #065f46;">📄 Hospital Shift Audit Report Printable Document</span>
    <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">🖨️ Click to Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 class="title">Regional General Hospital</h1>
      <div class="subtitle">Facility Manager Official Shift Audit Report • Tuesday Night Shift (7:00 PM – 7:00 AM)</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748b;">
      Generated: <strong>${timeDisplay}</strong><br/>
      Status: <strong style="color: #059669;">SHIFT COMPLETED</strong>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">SLA Compliance</div>
      <div class="kpi-val" style="color: #059669;">${slaCompliancePct}%</div>
      <div style="font-size: 11px; color: #64748b;">${completedZones} / ${totalZones} Zones</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sq Ft Cleaned</div>
      <div class="kpi-val" style="color: #2563eb;">${schedulePlan.estimatedTotalSqFtCleaned.toLocaleString()}</div>
      <div style="font-size: 11px; color: #64748b;">Square Feet</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Water Refills</div>
      <div class="kpi-val" style="color: #0284c7;">12 Cycles</div>
      <div style="font-size: 11px; color: #64748b;">10-Min Dock Recharges</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Disruptions</div>
      <div class="kpi-val" style="color: #d97706;">${disruptions.length} Events</div>
      <div style="font-size: 11px; color: #64748b;">Resolved via Dispatcher</div>
    </div>
  </div>

  <div class="section-title">Zone-by-Zone Hospital Cleaning Audit</div>
  <table>
    <thead>
      <tr>
        <th>Zone ID & Name</th>
        <th>Area</th>
        <th>Floor & Type</th>
        <th>Cleaning Window</th>
        <th>Assigned Robot</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="section-title">Consumables & Water Audit</div>
  <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; margin-bottom: 24px; font-size: 13px;">
    <strong>Clean Water Consumed:</strong> 142.5 Gallons total clean water across 5 wet scrubbing robots.<br/>
    <strong>Water Dump & Refill:</strong> 100% completed at assigned water docks.<br/>
    <strong>Leak Anomaly Flag:</strong> R-008 FloorBot FB-200 flagged for technician valve inspection (risk score 82/100).
  </div>

  <div class="section-title">Disruption Log & Escalations</div>
  ${disruptionsHtml}

  <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
    Official Facility Operations Record • Generated by Autonomous Fleet Dispatcher v4.2
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try { window.print(); } catch (e) { console.log(e); }
      }, 500);
    });
  </script>
</body>
</html>`;
  };

  const handleDownloadPrintableHTML = () => {
    const htmlContent = generatePrintableHTML();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hospital_Shift_Report_Printable_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✓ Printable Report HTML document downloaded! Open in any browser tab to print or save as PDF.');
  };

  const handlePrintReport = () => {
    setShowPrintModal(true);
    try {
      window.print();
    } catch (e) {
      console.warn("window.print() restricted in sandbox iframe, showing printable report modal.", e);
    }
  };

  return (
    <div className="space-y-6 text-white print:text-black print:bg-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-950 border border-emerald-600 text-emerald-200 text-xs font-mono px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-fade-in print:hidden">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Printable / PDF Executive Preview Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 print:hidden animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="bg-slate-800 p-4 px-6 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Printer className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Print / Save Shift Audit Report as PDF</h3>
                  <p className="text-xs text-slate-400">Official Facility Audit Record • Regional General Hospital</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Actions Toolbar */}
            <div className="bg-emerald-950/60 border-b border-emerald-800/60 p-3 px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-emerald-200 font-medium flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>If browser print prompt didn't appear automatically due to iframe sandbox, click below:</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownloadPrintableHTML}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Printable HTML / PDF</span>
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-lg flex items-center space-x-1.5 cursor-pointer border border-slate-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={handleDownloadTextReport}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-lg flex items-center space-x-1.5 cursor-pointer border border-slate-700"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>TXT</span>
                </button>
              </div>
            </div>

            {/* Modal Body / Paper Document Preview */}
            <div className="p-6 overflow-y-auto bg-slate-950 text-slate-900 font-sans space-y-6">
              <div className="bg-white p-8 rounded-xl border border-slate-300 shadow-xl space-y-6">
                
                {/* Header */}
                <div className="border-b-2 border-emerald-600 pb-4 flex justify-between items-end">
                  <div>
                    <h1 className="text-xl font-extrabold text-emerald-900">Regional General Hospital</h1>
                    <p className="text-xs text-slate-500 font-medium">Facility Manager Shift Audit Report • Tuesday Night Shift (7:00 PM – 7:00 AM)</p>
                  </div>
                  <div className="text-right text-xs text-slate-500 font-mono">
                    Generated: <strong className="text-slate-900">{timeDisplay}</strong><br/>
                    Status: <strong className="text-emerald-700">SHIFT COMPLETED</strong>
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500">SLA Compliance</div>
                    <div className="text-xl font-bold font-mono text-emerald-700">{slaCompliancePct}%</div>
                    <div className="text-[10px] text-slate-500">{completedZones}/{totalZones} Zones</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Sq Ft Cleaned</div>
                    <div className="text-xl font-bold font-mono text-blue-700">{schedulePlan.estimatedTotalSqFtCleaned.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">Square Feet</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Water Cycles</div>
                    <div className="text-xl font-bold font-mono text-cyan-700">12 Refills</div>
                    <div className="text-[10px] text-slate-500">10-Min Dock Recharges</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Disruptions</div>
                    <div className="text-xl font-bold font-mono text-amber-700">{disruptions.length} Events</div>
                    <div className="text-[10px] text-slate-500 font-mono">1 Escalated</div>
                  </div>
                </div>

                {/* Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-2 border-b border-slate-200 pb-1">
                    Zone-by-Zone Hospital Cleaning Audit
                  </h4>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] border-b border-slate-300">
                        <th className="p-2">Zone</th>
                        <th className="p-2">Area</th>
                        <th className="p-2">Classification</th>
                        <th className="p-2">Robot</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {FACILITY_ZONES.map(z => {
                        const zState = zoneStates.get(z.id);
                        const task = schedulePlan.tasks.find(t => t.zoneId === z.id);
                        return (
                          <tr key={z.id}>
                            <td className="p-2 font-bold">{z.id}: {z.name}</td>
                            <td className="p-2 font-mono">{z.sqFt} sq ft</td>
                            <td className="p-2">{z.classification}</td>
                            <td className="p-2 font-mono font-bold text-blue-800">{task ? task.robotId : 'UNASSIGNED'}</td>
                            <td className="p-2">
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                {zState?.status.toUpperCase() || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-800 p-4 border-t border-slate-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
              <button
                onClick={handleDownloadPrintableHTML}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Save Printable Document (HTML/PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:border-none print:shadow-none">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">Regional General Hospital - Facility Manager Shift Audit Report</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tuesday Night Shift (7:00 PM – 7:00 AM) • Generated at Shift Conclusion ({timeDisplay})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={handlePrintReport}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/30"
            title="Print or view executive printable document"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF Report</span>
          </button>

          <button
            onClick={handleDownloadPrintableHTML}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer"
            title="Download formatted printable document"
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Download HTML/PDF Document</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer"
            title="Download CSV spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleDownloadTextReport}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer"
            title="Download full text audit log"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Export TXT</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">SLA Compliance Index</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{slaCompliancePct}%</div>
          <div className="text-[11px] text-slate-400 mt-1">{completedZones} / {totalZones} Zones Completed</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">Total Sq Ft Cleaned</span>
          <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
            {schedulePlan.estimatedTotalSqFtCleaned.toLocaleString()} sq ft
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Hospital Floor Area</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">Water Refills Completed</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">12 Refills</div>
          <div className="text-[11px] text-slate-400 mt-1">10-Min Dump & Refill Cycles</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">Disruptions / Escalations</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{disruptions.length} Events</div>
          <div className="text-[11px] text-slate-400 mt-1">1 Human Ops Escalation</div>
        </div>

      </div>

      {/* Zone Cleaning Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zone-by-Zone Hospital Cleaning Audit</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="p-2.5">Zone</th>
                <th className="p-2.5">Area (Sq Ft)</th>
                <th className="p-2.5">Floor & Classification</th>
                <th className="p-2.5">Window</th>
                <th className="p-2.5">Assigned Robot</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {FACILITY_ZONES.map(zone => {
                const zState = zoneStates.get(zone.id);
                const assignedTask = schedulePlan.tasks.find(t => t.zoneId === zone.id);

                return (
                  <tr key={zone.id} className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-white">
                      {zone.id}: {zone.name}
                    </td>
                    <td className="p-2.5 font-mono text-slate-300">{zone.sqFt.toLocaleString()} sq ft</td>
                    <td className="p-2.5 text-slate-300">
                      {zone.floorType} • 
                      <span className={zone.requiresSterileRobot ? 'text-emerald-400 font-bold ml-1' : 'ml-1'}>
                        {zone.classification}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-slate-400">
                      {zone.cleaningWindowStart} - {zone.cleaningWindowEnd}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-blue-400">
                      {assignedTask ? assignedTask.robotId : 'UNASSIGNED'}
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        zState?.status === 'completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        zState?.status === 'in_progress' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                        'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {zState?.status.toUpperCase() || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disruption & OEM Reliability Audit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Consumables & Water Audit */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <h4 className="text-xs font-bold uppercase text-slate-300 flex items-center space-x-1.5">
            <Droplet className="w-4 h-4 text-cyan-400" />
            <span>Consumables & Water Cycles Audit</span>
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            All 5 wet scrubbers (AS-900, AS-900H, FB-200) completed scheduled 10-minute water dump & refill cycles. Total water volume consumed: <strong>142.5 Gallons</strong> clean water.
          </p>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 font-mono">
            Leak Anomaly Audit: R-008 FloorBot FB-200 water leak risk score (82/100) flagged for technician valve inspection.
          </div>
        </div>

        {/* OEM Error Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <h4 className="text-xs font-bold uppercase text-slate-300 flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>OEM Fault & Connection Summary</span>
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            1) AutoScrub: R-003 critical sensor fault at 2:15 AM. 2) CleanPath: R-005 WebSocket drop auto-reconnected in 14.2s. 3) FloorBot: R-006 offline garage mission reconciled 100% on reconnect.
          </p>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 font-mono">
            HAL Abstraction Layer isolated all 3 OEM quirks without causing fleet scheduler downtime.
          </div>
        </div>

      </div>

    </div>
  );
};

