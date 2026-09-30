/* ==========================================================================
   Operating Systems, Cycle by Cycle — CPU & Execution Visualizations (viz-cpu.js)
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 1. Hero Viz: Interactive CPU Scheduler (FIFO, SJF, STCF, Round Robin)
   * -------------------------------------------------------------------------- */
  OS.register('cpuScheduler', function (host) {
    let policy = 'RR';
    let quantum = 3;
    let processes = [
      { id: 'P1', arrival: 0, burst: 7, color: OS.C.p0 },
      { id: 'P2', arrival: 2, burst: 4, color: OS.C.p1 },
      { id: 'P3', arrival: 4, burst: 2, color: OS.C.p2 },
      { id: 'P4', arrival: 5, burst: 5, color: OS.C.p3 }
    ];

    const controls = OS.controls(host);
    const seg = OS.segmented(controls, {
      label: 'Policy',
      options: [
        { label: 'Round Robin (RR)', value: 'RR' },
        { label: 'FIFO', value: 'FIFO' },
        { label: 'SJF (Non-preemptive)', value: 'SJF' },
        { label: 'STCF (Preemptive)', value: 'STCF' }
      ],
      value: policy,
      onChange: (v) => { policy = v; quantumSlider.input.disabled = (v !== 'RR'); simulate(); }
    });

    const quantumSlider = OS.slider(controls, {
      id: 'sched-quantum',
      label: 'Time Quantum Q:',
      min: 1,
      max: 6,
      step: 1,
      value: quantum,
      format: (v) => `${v} ticks`,
      onInput: (v) => { quantum = v; simulate(); }
    });

    OS.button(controls, 'Randomize Bursts', () => {
      processes.forEach(p => { p.burst = Math.floor(Math.random() * 6) + 2; });
      simulate();
    });

    const ganttBox = OS.el('div', { class: 'gantt-wrap' });
    const ganttBar = OS.el('div', { class: 'gantt-bar' });
    const ganttTicks = OS.el('div', { class: 'gantt-ticks' });
    ganttBox.append(ganttBar, ganttTicks);
    host.appendChild(ganttBox);

    const readout = OS.readout(host);

    function simulate() {
      // Calculate scheduling execution timeline
      const timeline = [];
      const procs = processes.map(p => ({
        ...p,
        remaining: p.burst,
        start: -1,
        finish: -1
      }));

      let time = 0;
      let completed = 0;
      const totalProcs = procs.length;
      const readyQueue = [];

      // Simulation loop (up to 40 ticks limit)
      while (completed < totalProcs && time < 40) {
        // Enqueue newly arrived processes
        procs.forEach(p => {
          if (p.arrival === time && p.remaining > 0 && !readyQueue.includes(p)) {
            readyQueue.push(p);
          }
        });

        if (readyQueue.length === 0) {
          timeline.push({ id: 'IDLE', color: OS.C.line, duration: 1 });
          time++;
          continue;
        }

        let current;
        if (policy === 'FIFO') {
          current = readyQueue[0];
          const runTime = current.remaining;
          if (current.start === -1) current.start = time;
          timeline.push({ id: current.id, color: current.color, duration: runTime });
          time += runTime;
          current.remaining = 0;
          current.finish = time;
          readyQueue.shift();
          completed++;
        } else if (policy === 'SJF') {
          readyQueue.sort((a, b) => a.burst - b.burst);
          current = readyQueue.shift();
          if (current.start === -1) current.start = time;
          const runTime = current.remaining;
          timeline.push({ id: current.id, color: current.color, duration: runTime });
          time += runTime;
          current.remaining = 0;
          current.finish = time;
          completed++;
        } else if (policy === 'STCF') {
          readyQueue.sort((a, b) => a.remaining - b.remaining);
          current = readyQueue[0];
          if (current.start === -1) current.start = time;
          timeline.push({ id: current.id, color: current.color, duration: 1 });
          current.remaining--;
          time++;
          if (current.remaining === 0) {
            current.finish = time;
            readyQueue.shift();
            completed++;
          }
        } else if (policy === 'RR') {
          current = readyQueue.shift();
          if (current.start === -1) current.start = time;
          const runTime = Math.min(quantum, current.remaining);
          timeline.push({ id: current.id, color: current.color, duration: runTime });
          time += runTime;
          current.remaining -= runTime;

          // Check if other processes arrived during this slice
          procs.forEach(p => {
            if (p.arrival > time - runTime && p.arrival <= time && p.remaining > 0 && !readyQueue.includes(p) && p !== current) {
              readyQueue.push(p);
            }
          });

          if (current.remaining === 0) {
            current.finish = time;
            completed++;
          } else {
            readyQueue.push(current);
          }
        }
      }

      // Compact adjacent timeline slices
      const compacted = [];
      timeline.forEach(item => {
        if (compacted.length > 0 && compacted[compacted.length - 1].id === item.id) {
          compacted[compacted.length - 1].duration += item.duration;
        } else {
          compacted.push({ ...item });
        }
      });

      // Render Gantt Bar
      ganttBar.innerHTML = '';
      ganttTicks.innerHTML = '';
      const totalDuration = compacted.reduce((acc, c) => acc + c.duration, 0) || 1;

      compacted.forEach(item => {
        const slice = OS.el('div', {
          class: 'gantt-slice',
          text: item.id === 'IDLE' ? 'idle' : `${item.id} (${item.duration})`
        });
        slice.style.width = `${(item.duration / totalDuration) * 100}%`;
        slice.style.backgroundColor = item.color;
        if (item.id === 'IDLE') {
          slice.style.color = OS.C.muted;
          slice.style.background = 'repeating-linear-gradient(45deg, var(--sunk), var(--sunk) 6px, var(--line) 6px, var(--line) 12px)';
        }
        ganttBar.appendChild(slice);
      });

      ganttTicks.append(
        OS.el('span', { text: 't = 0' }),
        OS.el('span', { text: `total = ${totalDuration} ticks` })
      );

      // Compute performance metrics
      const validProcs = procs.filter(p => p.finish !== -1);
      const avgTurnaround = validProcs.reduce((acc, p) => acc + (p.finish - p.arrival), 0) / validProcs.length;
      const avgResponse = validProcs.reduce((acc, p) => acc + (p.start - p.arrival), 0) / validProcs.length;
      const busyTicks = compacted.filter(c => c.id !== 'IDLE').reduce((acc, c) => acc + c.duration, 0);
      const cpuUtil = Math.round((busyTicks / totalDuration) * 100);

      readout.innerHTML = `
        <b>Policy:</b> <span class="hl">${policy}</span> | 
        <b>Avg Turnaround Time:</b> <span class="hl">${avgTurnaround.toFixed(2)} ticks</span> | 
        <b>Avg Response Time:</b> <span class="hl">${avgResponse.toFixed(2)} ticks</span> | 
        <b>CPU Utilization:</b> <span class="hl">${cpuUtil}%</span><br>
        <span style="font-size:0.75rem; color:var(--muted)">Turnaround = Finish − Arrival. Response = First Run − Arrival. Round Robin optimizes response time at the cost of turnaround time.</span>
      `;
    }

    simulate();
  });

  /* --------------------------------------------------------------------------
   * 2. Dual-Mode & System Call Stepper
   * -------------------------------------------------------------------------- */
  OS.register('dualMode', function (host) {
    const steps = [
      {
        ring: 'Ring 3 (User Mode)',
        action: 'Application invokes read(fd, buf, 1024)',
        desc: 'Process sets up arguments in registers (%rdi = fd, %rsi = buf, %rdx = 1024, %rax = 0 for SYS_read).',
        userActive: true, kernelActive: false
      },
      {
        ring: 'Hardware Trap Gate',
        action: 'CPU executes SYSCALL instruction',
        desc: 'Hardware automatically switches privilege bit from User (Ring 3) to Kernel (Ring 0), saves RIP/RSP to kernel stack, and jumps to entry_SYSCALL_64.',
        userActive: false, kernelActive: false, trapActive: true
      },
      {
        ring: 'Ring 0 (Kernel Mode)',
        action: 'Kernel Dispatches via Syscall Table',
        desc: 'Kernel validates user pointers (buf), looks up file descriptor in process fd_table, and calls vfs_read().',
        userActive: false, kernelActive: true
      },
      {
        ring: 'Ring 0 (Kernel Mode)',
        action: 'I/O & Page Cache Transfer',
        desc: 'Kernel copies requested file data from kernel page cache into user buffer memory via copy_to_user().',
        userActive: false, kernelActive: true
      },
      {
        ring: 'Ring 3 (User Mode)',
        action: 'CPU executes SYSRET instruction',
        desc: 'Privilege bit restored to Ring 3. User registers restored. Return value (bytes read) stored in %rax. Execution resumes.',
        userActive: true, kernelActive: false
      }
    ];

    let currentStep = 0;

    const controls = OS.controls(host);
    OS.button(controls, '◀ Previous Step', () => {
      currentStep = Math.max(0, currentStep - 1);
      render();
    });
    OS.button(controls, 'Next Step ▶', () => {
      currentStep = Math.min(steps.length - 1, currentStep + 1);
      render();
    }, { primary: true });
    OS.button(controls, 'Reset Flow', () => {
      currentStep = 0;
      render();
    });

    const cv = OS.canvas(host, {
      height: 220,
      label: 'Dual mode syscall transition',
      draw: (ctx, w, h) => {
        const s = steps[currentStep];

        // Draw User Space Box (Top)
        const userY = 20;
        const boxH = 65;
        ctx.fillStyle = s.userActive ? OS.rgba(OS.C.user, 0.12) : OS.C.sunk;
        ctx.strokeStyle = s.userActive ? OS.C.user : OS.C.line;
        ctx.lineWidth = s.userActive ? 2 : 1;
        ctx.roundRect(20, userY, w - 40, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = s.userActive ? OS.C.user : OS.C.muted;
        ctx.font = OS.font(13, 'mono', 600);
        ctx.fillText('RING 3 — USER SPACE (Unprivileged: CPL = 3)', 35, userY + 24);
        ctx.font = OS.font(12, 'sans', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('User Process Address Space · Memory isolation active · Direct hardware I/O forbidden', 35, userY + 46);

        // Draw Boundary Line
        const boundY = 105;
        ctx.strokeStyle = s.trapActive ? OS.C.rose : OS.C.line;
        ctx.lineWidth = s.trapActive ? 3 : 1;
        ctx.setLineDash(s.trapActive ? [] : [6, 4]);
        ctx.beginPath();
        ctx.moveTo(20, boundY);
        ctx.lineTo(w - 20, boundY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = s.trapActive ? OS.C.rose : OS.C.faint;
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillText('HARDWARE PRIVILEGE BOUNDARY (TRAP / SYSRET)', w / 2 - 120, boundY - 6);

        // Draw Kernel Space Box (Bottom)
        const kernY = 125;
        ctx.fillStyle = s.kernelActive ? OS.rgba(OS.C.kernel, 0.12) : OS.C.sunk;
        ctx.strokeStyle = s.kernelActive ? OS.C.kernel : OS.C.line;
        ctx.lineWidth = s.kernelActive ? 2 : 1;
        ctx.roundRect(20, kernY, w - 40, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = s.kernelActive ? OS.C.kernel : OS.C.muted;
        ctx.font = OS.font(13, 'mono', 600);
        ctx.fillText('RING 0 — KERNEL SPACE (Privileged: CPL = 0)', 35, kernY + 24);
        ctx.font = OS.font(12, 'sans', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Kernel Virtual Memory · Page Tables · Interrupt Handlers · Device Drivers · Full Hardware Access', 35, kernY + 46);

        // Indicator Arrow
        ctx.fillStyle = s.trapActive ? OS.C.rose : (s.userActive ? OS.C.user : OS.C.kernel);
        ctx.beginPath();
        ctx.arc(w - 50, s.userActive ? userY + 32 : (s.kernelActive ? kernY + 32 : boundY), 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      const s = steps[currentStep];
      readout.innerHTML = `
        <b>Step ${currentStep + 1}/${steps.length}:</b> <span class="hl">${s.action}</span><br>
        <b>Location:</b> ${s.ring} | <b>Detail:</b> ${s.desc}
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 3. Process State Machine & PCB Simulator
   * -------------------------------------------------------------------------- */
  OS.register('processLifecycle', function (host) {
    const states = ['NEW', 'READY', 'RUNNING', 'BLOCKED', 'TERMINATED'];
    let currentState = 'READY';
    let pid = 1042;
    let cpuCycles = 140;

    const controls = OS.controls(host);
    OS.button(controls, 'Schedule (Ready → Running)', () => {
      if (currentState === 'READY') { currentState = 'RUNNING'; cpuCycles += 20; }
      render();
    });
    OS.button(controls, 'Timer Interrupt (Yield)', () => {
      if (currentState === 'RUNNING') { currentState = 'READY'; }
      render();
    });
    OS.button(controls, 'I/O Request (Block)', () => {
      if (currentState === 'RUNNING') { currentState = 'BLOCKED'; }
      render();
    });
    OS.button(controls, 'I/O Complete (Wake)', () => {
      if (currentState === 'BLOCKED') { currentState = 'READY'; }
      render();
    });
    OS.button(controls, 'Exit (Terminate)', () => {
      if (currentState === 'RUNNING') { currentState = 'TERMINATED'; }
      render();
    });
    OS.button(controls, 'Fork New Process', () => {
      pid = Math.floor(Math.random() * 8000) + 1000;
      currentState = 'READY';
      cpuCycles = 0;
      render();
    });

    const grid = OS.el('div', { class: 'state-grid' });
    states.forEach(st => {
      const box = OS.el('div', { class: `state-box ${st.toLowerCase()}`, id: `st-${st}`, text: st });
      grid.appendChild(box);
    });
    host.appendChild(grid);

    const readout = OS.readout(host);

    function render() {
      states.forEach(st => {
        const el = document.getElementById(`st-${st}`);
        if (el) {
          if (st === currentState) el.classList.add('active');
          else el.classList.remove('active');
        }
      });

      readout.innerHTML = `
        <b>Process Control Block (PCB) [PID: ${pid}]</b><br>
        • <b>State:</b> <span class="hl">${currentState}</span> &nbsp;|&nbsp; 
        • <b>Program Counter (PC):</b> <code>${OS.fmtHex(0x00400000 + cpuCycles * 4, 8)}</code> &nbsp;|&nbsp; 
        • <b>Registers:</b> <code>RAX=0x${(cpuCycles).toString(16)}, RSP=0x7FFFEEA0</code><br>
        • <b>Open File Descriptors:</b> <code>[0: stdin, 1: stdout, 2: stderr, 3: socket]</code> &nbsp;|&nbsp; 
        • <b>Priority:</b> Normal (Nice 0)
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 4. Multi-Level Feedback Queue (MLFQ) Simulator
   * -------------------------------------------------------------------------- */
  OS.register('mlfq', function (host) {
    let queues = [
      { name: 'Q0 (High Priority)', quantum: 8, jobs: ['WebUI (Interactive)'] },
      { name: 'Q1 (Medium Priority)', quantum: 16, jobs: ['Compiler (Worker)'] },
      { name: 'Q2 (Low Priority / Batch)', quantum: 32, jobs: ['Video Render (CPU-bound)'] }
    ];

    const controls = OS.controls(host);
    OS.button(controls, 'Run 1 Tick', () => {
      // If Q0 has jobs, run Q0; if a job exhausts its time slice, demote it
      if (queues[0].jobs.length > 0) {
        const j = queues[0].jobs.shift();
        queues[1].jobs.push(j);
      } else if (queues[1].jobs.length > 0) {
        const j = queues[1].jobs.shift();
        queues[2].jobs.push(j);
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Simulate I/O Relinquish', () => {
      // Interactive jobs yield CPU before slice ends -> stay at Q0
      if (!queues[0].jobs.includes('WebUI (Interactive)')) {
        queues[1].jobs = queues[1].jobs.filter(j => j !== 'WebUI (Interactive)');
        queues[2].jobs = queues[2].jobs.filter(j => j !== 'WebUI (Interactive)');
        queues[0].jobs.unshift('WebUI (Interactive)');
      }
      render();
    });

    OS.button(controls, 'Trigger Priority Boost (S = 100ms)', () => {
      // Rule 5: Priority boost prevents starvation
      const allJobs = [...queues[0].jobs, ...queues[1].jobs, ...queues[2].jobs];
      queues[0].jobs = allJobs;
      queues[1].jobs = [];
      queues[2].jobs = [];
      render();
    });

    const cv = OS.canvas(host, {
      height: 200,
      label: 'MLFQ queue hierarchy',
      draw: (ctx, w, h) => {
        const rowH = 50;
        queues.forEach((q, i) => {
          const y = 20 + i * (rowH + 10);
          ctx.fillStyle = OS.C.sunk;
          ctx.strokeStyle = i === 0 ? OS.C.accent : OS.C.line;
          ctx.lineWidth = i === 0 ? 2 : 1;
          ctx.roundRect(20, y, w - 40, rowH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = i === 0 ? OS.C.accent : OS.C.muted;
          ctx.font = OS.font(12, 'mono', 600);
          ctx.fillText(`${q.name} · Time Slice = ${q.quantum}ms`, 35, y + 20);

          // Draw jobs in queue
          let jx = 35;
          ctx.font = OS.font(11, 'mono', 500);
          if (q.jobs.length === 0) {
            ctx.fillStyle = OS.C.faint;
            ctx.fillText('(Queue empty)', jx, y + 38);
          } else {
            q.jobs.forEach(job => {
              const tw = ctx.measureText(job).width;
              ctx.fillStyle = OS.rgba(OS.C.accent, 0.15);
              ctx.roundRect(jx - 4, y + 25, tw + 8, 18, 4);
              ctx.fill();
              ctx.fillStyle = OS.C.ink;
              ctx.fillText(job, jx, y + 38);
              jx += tw + 18;
            });
          }
        });
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>MLFQ 5 Core Rules:</b> 
        1. If Priority(A) > Priority(B), A runs. | 
        2. If Priority(A) == Priority(B), A & B run in Round Robin. | 
        3. New jobs enter at top (Q0). | 
        4. Once a job uses its time allotment at a given priority, its priority is reduced. | 
        5. After time period S, move all jobs to topmost queue (Priority Boost).
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 5. Hardware Cache Coherence (MESI Protocol)
   * -------------------------------------------------------------------------- */
  OS.register('mesi', function (host) {
    let core0State = 'Exclusive';
    let core1State = 'Invalid';
    let cacheLineAddr = '0x1000';
    let value = 42;

    const controls = OS.controls(host);
    OS.button(controls, 'Core 0 Reads', () => {
      if (core1State === 'Modified') { core1State = 'Shared'; }
      core0State = (core1State === 'Shared') ? 'Shared' : 'Exclusive';
      render();
    });
    OS.button(controls, 'Core 0 Writes (Val = 99)', () => {
      value = 99;
      core0State = 'Modified';
      core1State = 'Invalid'; // Bus Invalidate broadcast
      render();
    });
    OS.button(controls, 'Core 1 Reads', () => {
      if (core0State === 'Modified') { core0State = 'Shared'; }
      core1State = 'Shared';
      if (core0State === 'Exclusive') core0State = 'Shared';
      render();
    });
    OS.button(controls, 'Core 1 Writes (Val = 100)', () => {
      value = 100;
      core1State = 'Modified';
      core0State = 'Invalid'; // Bus Invalidate broadcast
      render();
    });

    const cv = OS.canvas(host, {
      height: 190,
      label: 'MESI protocol cache coherence',
      draw: (ctx, w, h) => {
        const boxW = Math.min(220, (w - 70) / 2);
        const boxH = 90;

        // Core 0 Box
        ctx.fillStyle = core0State === 'Invalid' ? OS.C.sunk : OS.rgba(OS.C.p0, 0.1);
        ctx.strokeStyle = core0State === 'Invalid' ? OS.C.line : OS.C.p0;
        ctx.lineWidth = 2;
        ctx.roundRect(25, 20, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(13, 'mono', 600);
        ctx.fillText('CPU CORE 0 (L1 Cache)', 35, 42);
        ctx.font = OS.font(12, 'mono', 400);
        ctx.fillText(`Tag: ${cacheLineAddr} · Data: ${value}`, 35, 66);
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillStyle = core0State === 'Invalid' ? OS.C.rose : OS.C.teal;
        ctx.fillText(`MESI State: [${core0State.toUpperCase()}]`, 35, 90);

        // Core 1 Box
        const c1X = w - 25 - boxW;
        ctx.fillStyle = core1State === 'Invalid' ? OS.C.sunk : OS.rgba(OS.C.p1, 0.1);
        ctx.strokeStyle = core1State === 'Invalid' ? OS.C.line : OS.C.p1;
        ctx.lineWidth = 2;
        ctx.roundRect(c1X, 20, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(13, 'mono', 600);
        ctx.fillText('CPU CORE 1 (L1 Cache)', c1X + 10, 42);
        ctx.font = OS.font(12, 'mono', 400);
        ctx.fillText(`Tag: ${cacheLineAddr} · Data: ${value}`, c1X + 10, 66);
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillStyle = core1State === 'Invalid' ? OS.C.rose : OS.C.teal;
        ctx.fillText(`MESI State: [${core1State.toUpperCase()}]`, c1X + 10, 90);

        // Shared Interconnect Bus
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.amber;
        ctx.lineWidth = 2;
        ctx.roundRect(25, 130, w - 50, 40, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = OS.C.amber;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('SHARED HARDWARE MEMORY BUS / INTERCONNECT (Snooping Active)', 45, 155);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>MESI State Meanings:</b> 
        <b>M (Modified):</b> Dirty cache line, only present in this core, memory is stale. | 
        <b>E (Exclusive):</b> Clean cache line, only in this core. | 
        <b>S (Shared):</b> Clean cache line, present in multiple cores. | 
        <b>I (Invalid):</b> Cache line is stale and cannot be read without a bus transaction.
      `;
    }

    render();
  });

})();
