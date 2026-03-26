'use client';

import { useState } from "react";
import { PieChart, AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck, Info } from "lucide-react";
import Link from "next/link";

type ReportData = {
    score: number;
    grade: string;
    color: string;
    warnings: string[];
    positives: string[];
};

export default function TokenomicsAuditPage() {
  const [allocations, setAllocations] = useState({
      liquidity: 15,
      team: 15,
      investors: 10,
      community: 40,
      treasury: 20
  });

  const[report, setReport] = useState<ReportData | null>(null);

  // Calculate total to ensure it equals 100%
  const total = Object.values(allocations).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const isInvalid = total !== 100;

  const handleChange = (field: keyof typeof allocations, value: string) => {
      setAllocations(prev => ({ ...prev, [field]: value === "" ? 0 : Number(value) }));
      setReport(null); // Reset report if they change values
  };

  const runAudit = () => {
      if (isInvalid) return;

      const warnings: string[] = [];
      const positives: string[] =[];
      let score = 100;

      // 1. Analyze Insider Concentration (Team + Investors)
      const insiderTotal = allocations.team + allocations.investors;
      if (insiderTotal > 40) {
          warnings.push(`High Insider Concentration (${insiderTotal}%). This is a massive red flag for retail investors. Strict vesting schedules are absolutely mandatory.`);
          score -= 30;
      } else if (insiderTotal > 25) {
          warnings.push(`Moderate Insider Concentration (${insiderTotal}%). Investors will expect multi-year vesting for team and seed allocations.`);
          score -= 15;
      } else {
          positives.push(`Healthy Insider Allocation (${insiderTotal}%). This signals a fair launch and reduces dump risk.`);
      }

      // 2. Analyze Liquidity
      if (allocations.liquidity < 10) {
          warnings.push(`Low Initial Liquidity (${allocations.liquidity}%). The token will be highly volatile and prone to manipulation. Lock your LP immediately to build trust.`);
          score -= 20;
      } else if (allocations.liquidity >= 15) {
          positives.push(`Strong Initial Liquidity (${allocations.liquidity}%). This provides excellent price stability for early buyers.`);
      }

      // 3. Analyze Community / Ecosystem
      if (allocations.community < 20) {
          warnings.push(`Low Community Incentives (${allocations.community}%). You may struggle to bootstrap network effects and user acquisition.`);
          score -= 10;
      } else {
          positives.push(`Strong Community Focus (${allocations.community}%). High allocation for airdrops or rewards drives adoption.`);
      }

      // Grade Calculation
      let grade = "A"; let color = "text-green-400";
      if (score < 60) { grade = "D"; color = "text-red-400"; }
      else if (score < 75) { grade = "C"; color = "text-[#E0A831]"; }
      else if (score < 90) { grade = "B"; color = "text-blue-400"; }

      setReport({ score, grade, color, warnings, positives });
  };

  return (
    <main className="min-h-full px-6 md:px-12 py-10 max-w-5xl mx-auto flex flex-col">
      
      {/* HEADER */}
      <div className="flex flex-col items-start mb-12 shrink-0">
        <h1 className="text-4xl md:text-5xl font-chakra font-bold text-white mb-2 tracking-tight">
          Tokenomics <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Audit</span>
        </h1>
        <p className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest">
          Public Risk Assessor for Token Distributions
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT: THE FORM */}
          <div className="w-full lg:w-[400px] shrink-0">
              <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs">📊</div>
                      <h2 className="text-white font-medium text-lg font-sans">Allocation Setup</h2>
                  </div>

                  <p className="text-xs text-[#555566] font-sans mb-6">Enter your token distribution percentages. The total must equal exactly 100%.</p>

                  <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between bg-[#0B0B0F] border border-[#1C1C26] rounded-xl p-3">
                          <span className="text-xs font-mono uppercase tracking-widest text-[#8B8B9E]">Initial Liquidity (LP)</span>
                          <div className="flex items-center gap-2">
                              <input type="number" className="w-16 bg-transparent text-right text-white font-mono focus:outline-none" value={allocations.liquidity} onChange={(e) => handleChange('liquidity', e.target.value)} />
                              <span className="text-[#555566] font-mono">%</span>
                          </div>
                      </div>
                      <div className="flex items-center justify-between bg-[#0B0B0F] border border-[#1C1C26] rounded-xl p-3">
                          <span className="text-xs font-mono uppercase tracking-widest text-[#8B8B9E]">Team & Founders</span>
                          <div className="flex items-center gap-2">
                              <input type="number" className="w-16 bg-transparent text-right text-white font-mono focus:outline-none" value={allocations.team} onChange={(e) => handleChange('team', e.target.value)} />
                              <span className="text-[#555566] font-mono">%</span>
                          </div>
                      </div>
                      <div className="flex items-center justify-between bg-[#0B0B0F] border border-[#1C1C26] rounded-xl p-3">
                          <span className="text-xs font-mono uppercase tracking-widest text-[#8B8B9E]">Private Investors / VC</span>
                          <div className="flex items-center gap-2">
                              <input type="number" className="w-16 bg-transparent text-right text-white font-mono focus:outline-none" value={allocations.investors} onChange={(e) => handleChange('investors', e.target.value)} />
                              <span className="text-[#555566] font-mono">%</span>
                          </div>
                      </div>
                      <div className="flex items-center justify-between bg-[#0B0B0F] border border-[#1C1C26] rounded-xl p-3">
                          <span className="text-xs font-mono uppercase tracking-widest text-[#8B8B9E]">Community / Airdrop</span>
                          <div className="flex items-center gap-2">
                              <input type="number" className="w-16 bg-transparent text-right text-white font-mono focus:outline-none" value={allocations.community} onChange={(e) => handleChange('community', e.target.value)} />
                              <span className="text-[#555566] font-mono">%</span>
                          </div>
                      </div>
                      <div className="flex items-center justify-between bg-[#0B0B0F] border border-[#1C1C26] rounded-xl p-3">
                          <span className="text-xs font-mono uppercase tracking-widest text-[#8B8B9E]">Treasury / Ecosystem</span>
                          <div className="flex items-center gap-2">
                              <input type="number" className="w-16 bg-transparent text-right text-white font-mono focus:outline-none" value={allocations.treasury} onChange={(e) => handleChange('treasury', e.target.value)} />
                              <span className="text-[#555566] font-mono">%</span>
                          </div>
                      </div>
                  </div>

                  <div className={`flex justify-between items-center px-4 py-3 rounded-xl border mb-6 font-mono text-xs uppercase tracking-widest ${isInvalid ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                      <span>Total Allocation:</span>
                      <span>{total}%</span>
                  </div>

                  <button 
                      onClick={runAudit} 
                      disabled={isInvalid}
                      className={`w-full py-4 rounded-xl font-mono text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isInvalid ? 'bg-[#1A1A24] text-[#555566] cursor-not-allowed border border-white/5' : 'btn-primary'}`}
                  >
                      <PieChart size={16} /> Run Automated Audit
                  </button>
              </div>
          </div>

          {/* RIGHT: THE REPORT & CTA */}
          <div className="flex-1 w-full">
              {!report ? (
                  <div className="h-full flex flex-col items-center justify-center bg-[#13131A]/30 border border-[#1C1C26] border-dashed rounded-2xl p-12 text-center opacity-50">
                      <ShieldCheck size={48} className="text-[#555566] mb-4" />
                      <p className="text-white font-mono uppercase tracking-widest text-sm mb-2">Awaiting Data</p>
                      <p className="text-[#8B8B9E] font-sans text-xs max-w-sm">Enter your allocations and run the audit to receive an objective risk report.</p>
                  </div>
              ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col h-full">
                      <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6 md:p-8 flex-1 mb-6 relative overflow-hidden">
                          {/* Giant Watermark Grade */}
                          <div className={`absolute -bottom-10 -right-10 text-[200px] font-chakra font-bold opacity-5 ${report.color} pointer-events-none select-none leading-none`}>
                              {report.grade}
                          </div>

                          <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-6 relative z-10">
                              <div>
                                  <h3 className="text-white font-sans text-2xl font-bold mb-1">Audit Results</h3>
                                  <span className="text-[#8B8B9E] font-mono text-[10px] uppercase tracking-widest">Score based on decentralization & trust</span>
                              </div>
                              <div className="text-right">
                                  <span className={`text-4xl font-chakra font-bold ${report.color}`}>{report.score}/100</span>
                                  <span className="block text-[#555566] font-mono text-[10px] uppercase tracking-widest mt-1">Grade: {report.grade}</span>
                              </div>
                          </div>

                          <div className="space-y-6 relative z-10">
                              {/* Positives */}
                              {report.positives.length > 0 && (
                                  <div>
                                      <h4 className="flex items-center gap-2 text-green-400 font-mono text-[10px] uppercase tracking-widest mb-3">
                                          <CheckCircle2 size={12} /> Institutional Strengths
                                      </h4>
                                      <ul className="space-y-3">
                                          {report.positives.map((pos, idx) => (
                                              <li key={idx} className="bg-green-500/5 border border-green-500/10 p-4 rounded-xl text-xs text-zinc-300 font-sans leading-relaxed">
                                                  {pos}
                                              </li>
                                          ))}
                                      </ul>
                                  </div>
                              )}

                              {/* Warnings */}
                              {report.warnings.length > 0 && (
                                  <div className="pt-2">
                                      <h4 className="flex items-center gap-2 text-[#E0A831] font-mono text-[10px] uppercase tracking-widest mb-3">
                                          <AlertTriangle size={12} /> Security Vulnerabilities
                                      </h4>
                                      <ul className="space-y-3">
                                          {report.warnings.map((warn, idx) => (
                                              <li key={idx} className="bg-[#E0A831]/5 border border-[#E0A831]/10 p-4 rounded-xl text-xs text-zinc-300 font-sans leading-relaxed">
                                                  {warn}
                                              </li>
                                          ))}
                                      </ul>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* THE HARD CTA */}
                      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-purple-500/20 p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shrink-0 relative overflow-hidden">
                          <div className="relative z-10 text-center md:text-left">
                              <h4 className="text-white font-chakra text-xl font-bold mb-2">Secure Your Tokenomics</h4>
                              <p className="text-xs text-zinc-400 font-sans max-w-sm leading-relaxed">
                                  Promises don't build trust, code does. Protect your investors by securing your Liquidity and Team allocations with immutable smart contracts.
                              </p>
                          </div>
                          <Link href="/create" className="w-full md:w-auto shrink-0 relative z-10">
                              <button className="w-full btn-primary flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                                  Lock Assets <ArrowRight size={14} />
                              </button>
                          </Link>
                      </div>
                  </div>
              )}
          </div>

      </div>
    </main>
  );
}