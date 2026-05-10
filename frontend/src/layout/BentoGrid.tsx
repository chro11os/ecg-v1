import React from 'react';

const BentoGrid = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-3 gap-3 p-4 h-screen max-h-[800px]">

      {/* 1. Large Main Feature (Top Left) */}
      <div className="md:col-span-2 md:row-span-2 bg-zinc-100 rounded-2xl p-4">
        {/* Component Goes Here */}
      </div>

      {/* 2. Top Right Small */}
      <div className="bg-zinc-100 rounded-2xl p-4">
        {/* Component Goes Here */}
      </div>

      {/* 3. Middle Right Small */}
      <div className="bg-zinc-100 rounded-2xl p-4">
        {/* Component Goes Here */}
      </div>

      {/* 4. Bottom Row Wide */}
      <div className="md:col-span-3 bg-zinc-100 rounded-2xl p-4">
        {/* Component Goes Here */}
      </div>

      {/* 5. Bottom Right Tall */}
      <div className="bg-zinc-100 rounded-2xl p-4">
        {/* Component Goes Here */}
      </div>

    </div>
  );
};

export default BentoGrid;
