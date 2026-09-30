/* ==========================================================================
   Operating Systems, Cycle by Cycle — Concurrency Visualizations (viz-concurrency.js)
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 1. Critical Section & Race Condition Stepper
   * -------------------------------------------------------------------------- */
  OS.register('raceCondition', function (host) {
    let mutexEnabled = false;
    let sharedCounter = 0;
    let threadAReg = 0;
    let threadBReg = 0;
    let stepIndex = 0;

    const instructions = [
      { thread: 'A', asm: 'MOV %eax, (counter)', effect: () => { threadAReg = sharedCounter; } },
      { thread: 'A', asm: 'ADD $1, %eax', effect: () => { threadAReg++; } },
      { thread: 'B', asm: 'MOV %ebx, (counter)', effect: () => { threadBReg = sharedCounter; } }, // Preemption!
      { thread: 'B', asm: 'ADD $1, %ebx', effect: () => { threadBReg++; } },
      { thread: 'B', asm: 'MOV (counter), %ebx', effect: () => { sharedCounter = threadBReg; } },
      { thread: 'A', asm: 'MOV (counter), %eax', effect: () => { sharedCounter = threadAReg; } } // Overwrites B!
    ];

    const controls = OS.controls(host);
    const seg = OS.segmented(controls, {
      label: 'Lock Mode',
      options: [
        { label: 'No Lock (Race Condition)', value: 'unlocked' },
        { label: 'With Mutex Lock', value: 'locked' }
      ],
      value: mutexEnabled ? 'locked' : 'unlocked',
      onChange: (v) => {
        mutexEnabled = (v === 'locked');
        reset();
      }
    });

    OS.button(controls, 'Step Instruction ▶', () => {
      if (mutexEnabled) {
        // With mutex, Thread A finishes before Thread B can enter
        if (stepIndex < 3) {
          if (stepIndex === 0) threadAReg = sharedCounter;
          if (stepIndex === 1) threadAReg++;
          if (stepIndex === 2) sharedCounter = threadAReg;
        } else if (stepIndex < 6) {
          if (stepIndex === 3) threadBReg = sharedCounter;
          if (stepIndex === 4) threadBReg++;
          if (stepIndex === 5) sharedCounter = threadBReg;
        }
      } else {
        if (stepIndex < instructions.length) {
          instructions[stepIndex].effect();
        }
      }
      stepIndex++;
      render();
    }, { primary: true });

    OS.button(controls, 'Reset Threads', reset);

    function reset() {
      stepIndex = 0;
      sharedCounter = 0;
      threadAReg = 0;
      threadBReg = 0;
      render();
    }

    const cv = OS.canvas(host, {
      height: 190,
      label: 'Race condition execution interleaving',
      draw: (ctx, w, h) => {
        const colW = Math.min(180, (w - 80) / 3);

        // Thread A Column
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.roundRect(25, 20, colW, 140, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText('THREAD A', 35, 42);
        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Register %eax: ${threadAReg}`, 35, 70);
        ctx.fillText(`Lock: ${mutexEnabled && stepIndex > 0 && stepIndex <= 3 ? 'HELD' : 'FREE'}`, 35, 95);

        // Shared Counter in Center
        const midX = 25 + colW + 15;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(midX, 20, colW, 140, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.amber;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText('SHARED MEMORY', midX + 10, 42);
        ctx.font = OS.font(20, 'mono', 700);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`counter = ${sharedCounter}`, midX + 10, 85);
        ctx.font = OS.font(11, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Target: counter = 2', midX + 10, 115);

        // Thread B Column
        const bX = midX + colW + 15;
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.1);
        ctx.strokeStyle = OS.C.teal;
        ctx.roundRect(bX, 20, colW, 140, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.teal;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText('THREAD B', bX + 10, 42);
        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Register %ebx: ${threadBReg}`, bX + 10, 70);
        ctx.fillText(`Lock: ${mutexEnabled && stepIndex > 3 ? 'HELD' : (mutexEnabled && stepIndex > 0 && stepIndex <= 3 ? 'BLOCKED' : 'FREE')}`, bX + 10, 95);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      if (mutexEnabled) {
        readout.innerHTML = `
          <b>Status (Mutex Active):</b> Step ${stepIndex}/6.<br>
          Thread A enters critical section and acquires lock. Thread B attempts to enter and is <b>blocked</b> until Thread A releases the lock. Final counter = <span class="hl">${sharedCounter}</span> (Correct).
        `;
      } else {
        const curAsm = stepIndex < instructions.length ? `Next: <code>${instructions[stepIndex].asm}</code>` : 'Execution Completed';
        readout.innerHTML = `
          <b>Status (Race Condition):</b> Step ${stepIndex}/6. ${curAsm}<br>
          ${stepIndex >= 6 ? '<span style="color:var(--rose); font-weight:600">LOST UPDATE BUG!</span> Both threads executed <code>counter++</code>, but final counter is <b>1</b> instead of <b>2</b> due to non-atomic instruction interleaving!' : 'Non-atomic assembly instructions load, modify, and store shared memory.'}
        `;
      }
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 2. Producer-Consumer Bounded Buffer Simulator
   * -------------------------------------------------------------------------- */
  OS.register('producerConsumer', function (host) {
    const capacity = 5;
    let buffer = [10, 20];

    const controls = OS.controls(host);
    OS.button(controls, 'Produce Item ➔ [Buffer]', () => {
      if (buffer.length < capacity) {
        buffer.push(Math.floor(Math.random() * 90) + 10);
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Consume Item ➔ [Worker]', () => {
      if (buffer.length > 0) {
        buffer.shift();
      }
      render();
    });

    const cv = OS.canvas(host, {
      height: 140,
      label: 'Bounded buffer queue',
      draw: (ctx, w, h) => {
        const slotW = 55;
        const totalW = capacity * slotW;
        const startX = (w - totalW) / 2;

        for (let i = 0; i < capacity; i++) {
          const sx = startX + i * slotW;
          const isOccupied = i < buffer.length;

          ctx.fillStyle = isOccupied ? OS.rgba(OS.C.accent, 0.2) : OS.C.sunk;
          ctx.strokeStyle = isOccupied ? OS.C.accent : OS.C.line;
          ctx.lineWidth = 1.5;
          ctx.roundRect(sx, 35, slotW - 6, 55, 6);
          ctx.fill(); ctx.stroke();

          ctx.font = OS.font(13, 'mono', 600);
          ctx.fillStyle = isOccupied ? OS.C.accent : OS.C.faint;
          ctx.fillText(isOccupied ? buffer[i] : '∅', sx + 16, 68);
        }

        ctx.font = OS.font(11, 'mono', 500);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(`Slots: ${buffer.length} / ${capacity} occupied`, startX, 115);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      const isFull = buffer.length === capacity;
      const isEmpty = buffer.length === 0;

      readout.innerHTML = `
        <b>Condition Variables State:</b><br>
        • <b>empty_cv (Wait when buffer is full):</b> ${isFull ? '<span style="color:var(--rose); font-weight:600">PRODUCER SLEEPING (BLOCKED)</span>' : '<span style="color:var(--green)">PRODUCER CAN WRITE</span>'}<br>
        • <b>fill_cv (Wait when buffer is empty):</b> ${isEmpty ? '<span style="color:var(--rose); font-weight:600">CONSUMER SLEEPING (BLOCKED)</span>' : '<span style="color:var(--green)">CONSUMER CAN READ</span>'}
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 3. Dining Philosophers & Deadlock Graph
   * -------------------------------------------------------------------------- */
  OS.register('deadlock', function (host) {
    let mode = 'deadlock'; // 'deadlock' or 'hierarchy'
    let state = 'THINKING';

    const controls = OS.controls(host);
    OS.segmented(controls, {
      label: 'Deadlock Strategy',
      options: [
        { label: 'Unordered (Prone to Deadlock)', value: 'deadlock' },
        { label: 'Resource Hierarchy Ordering (Safe)', value: 'hierarchy' }
      ],
      value: mode,
      onChange: (v) => { mode = v; state = 'THINKING'; render(); }
    });

    OS.button(controls, 'All Philosophers Grab Left Chopstick', () => {
      if (mode === 'deadlock') {
        state = 'DEADLOCKED';
      } else {
        state = 'RESOLVED';
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Reset Table', () => {
      state = 'THINKING';
      render();
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Dining philosophers deadlock graph',
      draw: (ctx, w, h) => {
        const cx = w / 2;
        const cy = 90;
        const radius = 60;

        // Draw Table
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = state === 'DEADLOCKED' ? OS.C.rose : OS.C.line;
        ctx.lineWidth = state === 'DEADLOCKED' ? 3 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // 5 Philosophers around circle
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const px = cx + Math.cos(angle) * (radius + 20);
          const py = cy + Math.sin(angle) * (radius + 20);

          ctx.fillStyle = state === 'DEADLOCKED' ? OS.C.rose : OS.C.accent;
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = OS.font(9, 'mono', 600);
          ctx.fillText(`P${i}`, px - 6, py + 3);
        }

        ctx.fillStyle = state === 'DEADLOCKED' ? OS.C.rose : OS.C.ink;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText(state === 'DEADLOCKED' ? 'CIRCULAR WAIT DETECTED (DEADLOCK)' : (state === 'RESOLVED' ? 'RESOURCE ORDERING ENFORCED (NO DEADLOCK)' : '5 PHILOSOPHERS THINKING'), cx - 110, cy + 5);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      if (state === 'DEADLOCKED') {
        readout.innerHTML = `
          <b style="color:var(--rose)">4 Coffman Conditions Satisfied:</b><br>
          1. Mutual Exclusion (Chopsticks cannot be shared) | 2. Hold and Wait (Holding left, waiting for right) | 3. No Preemption | 4. <b>Circular Wait (Cycle P0→P1→P2→P3→P4→P0)</b>.<br>
          System is completely frozen.
        `;
      } else if (state === 'RESOLVED') {
        readout.innerHTML = `
          <b style="color:var(--green)">Coffman Condition 4 Broken:</b><br>
          By establishing a strict total resource ordering (e.g. Philosopher 4 picks up Chopstick 0 <i>before</i> Chopstick 4), the circular dependency is mathematically eliminated. Deadlock is impossible.
        `;
      } else {
        readout.innerHTML = `Each philosopher requires <b>two</b> chopsticks to eat. Click "All Philosophers Grab Left Chopstick" to observe deadlock.`;
      }
    }

    render();
  });

})();
