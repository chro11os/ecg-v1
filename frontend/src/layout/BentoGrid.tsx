import React from 'react';
import DiagnosisDashboard from '../components/DiagnosisDashboard';
import FileUploadArea from '../components/FileUploadArea';

const BentoGrid = () => {
  return (
    // 1. Set container to full viewport width/height and hide overflow
    <div className="h-screen w-screen bg-zinc-950 overflow-hidden p-2">

      {/* 2. Grid takes up 100% of parent space with no max-width */}
      <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-10 gap-2 h-full w-full">

        {/* 1. Primary Dashboard Section (Left 2/3) */}
        <div className="md:col-span-2 md:row-span-10 bg-[#0f172a] rounded-xl border border-white/5 overflow-hidden shadow-2xl flex flex-col">
          <div className="flex-1 overflow-auto p-4">
            <DiagnosisDashboard />
          </div>
        </div>

        {/* 2. Top Right - Metrics (1/3 width, 50% height) */}
        <div className="md:col-span-1 md:row-span-5 bg-white rounded-xl border border-zinc-200 shadow-sm p-6">
          <h3 className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Metrics</h3>
          <div className="mt-4 flex flex-col gap-3">
            <div className="w-full h-24 bg-zinc-50 rounded-lg border border-zinc-100" />
            <div className="w-full h-24 bg-zinc-50 rounded-lg border border-zinc-100" />
          </div>
        </div>

        {/* 3. Middle Right - System Status (1/3 width, 30% height) */}
        <div className="md:col-span-1 md:row-span-3 bg-[#18181b] rounded-xl shadow-inner p-6 flex flex-col border border-white/5">
          <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">System Status</h3>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-zinc-200 font-medium">All systems operational</p>
          </div>
        </div>

        {/* 4. Bottom Right Sliver - File Actions (1/3 width, 20% height) */}
        <div className="md:col-span-1 md:row-span-2 bg-white rounded-xl border border-zinc-200 shadow-sm p-4 flex flex-col justify-center">
          <FileUploadArea />
        </div>

      </div>
    </div>
  );
};

export default BentoGrid;
