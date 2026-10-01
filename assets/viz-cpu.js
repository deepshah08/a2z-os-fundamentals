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
      const avgTurnaround = validProcs.reduce((acc, p) => acc + (p.finish - p.arrival), 0) / (validProcs.length || 1);
      const avgResponse = validProcs.reduce((acc, p) => acc + (p.start - p.arrival), 0) / (validProcs.length || 1);
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
   * 4. Advanced Scheduling: MLFQ & Linux CFS Dual-Mode Simulator
   * -------------------------------------------------------------------------- */
  OS.register('mlfq', function (host) {
    let mode = 'mlfq'; // 'mlfq' or 'cfs'

    // --- MLFQ State ---
    let mlfqQueues = [
      { name: 'Q0 (8ms Quantum · Top Priority)', quantum: 8, jobs: ['WebUI (Interactive)'] },
      { name: 'Q1 (16ms Quantum · Medium)', quantum: 16, jobs: ['Compiler (Worker)'] },
      { name: 'Q2 (32ms Quantum · Low/Batch)', quantum: 32, jobs: ['Video Render (CPU-bound)'] }
    ];
    let mlfqLastAction = 'System ready. Step through execution or trigger Priority Boost.';
    let mlfqTotalTicks = 0;

    // --- CFS State ---
    // nice levels: -5 (weight 3121), 0 (weight 1024), +10 (weight 110)
    let cfsTasks = [
      { id: 'Task A (nice -5)', nice: -5, weight: 3121, vruntime: 100, runtime: 0, color: OS.C.p0 },
      { id: 'Task B (nice 0)', nice: 0, weight: 1024, vruntime: 100, runtime: 0, color: OS.C.p1 },
      { id: 'Task C (nice +10)', nice: 10, weight: 110, vruntime: 100, runtime: 0, color: OS.C.p2 }
    ];
    let cfsCurrent = cfsTasks[0];
    let cfsHistory = [];

    const controls = OS.controls(host);
    const subControls = OS.el('div', { class: 'controls' });
    host.appendChild(subControls);

    OS.segmented(controls, {
      label: 'Scheduler Engine',
      options: [
        { label: 'Multi-Level Feedback Queue (MLFQ)', value: 'mlfq' },
        { label: 'Linux Completely Fair Scheduler (CFS)', value: 'cfs' }
      ],
      value: mode,
      onChange: (v) => {
        mode = v;
        updateButtons();
        render();
      }
    });

    let btnStep, btnAction, btnReset;

    function updateButtons() {
      subControls.innerHTML = '';
      if (mode === 'mlfq') {
        btnStep = OS.button(subControls, 'Run 1 Tick (Schedule Active Job)', () => {
          mlfqTotalTicks++;
          if (mlfqQueues[0].jobs.length > 0) {
            const j = mlfqQueues[0].jobs.shift();
            // If it's WebUI, simulate interactive job that yields early 50% of the time
            if (j.includes('WebUI') && Math.random() > 0.4) {
              mlfqQueues[0].jobs.push(j);
              mlfqLastAction = `${j} yielded CPU for user I/O before 8ms slice ended -> Retained in Q0 (Rule 4a)`;
            } else {
              mlfqQueues[1].jobs.push(j);
              mlfqLastAction = `${j} exhausted 8ms time slice in Q0 -> Demoted to Q1 (Rule 4b)`;
            }
          } else if (mlfqQueues[1].jobs.length > 0) {
            const j = mlfqQueues[1].jobs.shift();
            mlfqQueues[2].jobs.push(j);
            mlfqLastAction = `${j} exhausted 16ms time slice in Q1 -> Demoted to Q2 (Rule 4b)`;
          } else if (mlfqQueues[2].jobs.length > 0) {
            // Round Robin inside Q2!
            const j = mlfqQueues[2].jobs.shift();
            mlfqQueues[2].jobs.push(j);
            mlfqLastAction = `${j} executed 32ms quantum in Q2 -> Rotated in Round Robin (Rule 2)`;
          }
          render();
        }, { primary: true });

        btnAction = OS.button(subControls, '+ New Interactive Job (Enters Q0)', () => {
          const newName = `App-${Math.floor(Math.random() * 800) + 100} (Interactive)`;
          mlfqQueues[0].jobs.unshift(newName);
          mlfqLastAction = `New process ${newName} entered system -> Placed at topmost queue Q0 (Rule 3)`;
          render();
        });

        btnReset = OS.button(subControls, 'Priority Boost (Reset to Q0)', () => {
          const all = [...mlfqQueues[0].jobs, ...mlfqQueues[1].jobs, ...mlfqQueues[2].jobs];
          mlfqQueues[0].jobs = all;
          mlfqQueues[1].jobs = [];
          mlfqQueues[2].jobs = [];
          mlfqLastAction = `Periodic Priority Boost timer expired (S = 100ms) -> All jobs boosted to Q0 to prevent starvation (Rule 5)`;
          render();
        });
      } else {
        btnStep = OS.button(subControls, 'Run 1 CFS Tick (10ms)', () => {
          // Find task with lowest vruntime (leftmost in red-black tree)
          cfsTasks.sort((a, b) => a.vruntime - b.vruntime);
          cfsCurrent = cfsTasks[0];

          const deltaExec = 10; // 10ms real execution
          const deltaVruntime = (deltaExec * 1024) / cfsCurrent.weight;

          cfsCurrent.vruntime += deltaVruntime;
          cfsCurrent.runtime += deltaExec;

          cfsHistory.push({ id: cfsCurrent.id.split(' ')[0], color: cfsCurrent.color });
          if (cfsHistory.length > 32) cfsHistory.shift();

          // Re-sort after updating
          cfsTasks.sort((a, b) => a.vruntime - b.vruntime);
          render();
        }, { primary: true });

        btnAction = OS.button(subControls, 'Run 5 CFS Ticks', () => {
          for (let step = 0; step < 5; step++) {
            cfsTasks.sort((a, b) => a.vruntime - b.vruntime);
            cfsCurrent = cfsTasks[0];
            const deltaExec = 10;
            const deltaVruntime = (deltaExec * 1024) / cfsCurrent.weight;
            cfsCurrent.vruntime += deltaVruntime;
            cfsCurrent.runtime += deltaExec;
            cfsHistory.push({ id: cfsCurrent.id.split(' ')[0], color: cfsCurrent.color });
            if (cfsHistory.length > 32) cfsHistory.shift();
          }
          cfsTasks.sort((a, b) => a.vruntime - b.vruntime);
          render();
        });

        btnReset = OS.button(subControls, 'Reset CFS State', () => {
          cfsTasks = [
            { id: 'Task A (nice -5)', nice: -5, weight: 3121, vruntime: 100, runtime: 0, color: OS.C.p0 },
            { id: 'Task B (nice 0)', nice: 0, weight: 1024, vruntime: 100, runtime: 0, color: OS.C.p1 },
            { id: 'Task C (nice +10)', nice: 10, weight: 110, vruntime: 100, runtime: 0, color: OS.C.p2 }
          ];
          cfsHistory = [];
          cfsCurrent = cfsTasks[0];
          render();
        });
      }
    }

    updateButtons();

    const cv = OS.canvas(host, {
      height: 230,
      label: 'Advanced scheduler engine simulator',
      draw: (ctx, w, h) => {
        if (mode === 'mlfq') {
          // Render MLFQ Queues
          const rowH = 50;
          mlfqQueues.forEach((q, i) => {
            const y = 16 + i * (rowH + 10);
            ctx.fillStyle = OS.C.sunk;
            ctx.strokeStyle = i === 0 ? OS.C.accent : OS.C.line;
            ctx.lineWidth = i === 0 ? 2 : 1;
            ctx.roundRect(20, y, w - 40, rowH, 8);
            ctx.fill(); ctx.stroke();

            ctx.fillStyle = i === 0 ? OS.C.accent : OS.C.muted;
            ctx.font = OS.font(11, 'mono', 600);
            ctx.fillText(q.name, 35, y + 20);

            let jx = 35;
            ctx.font = OS.font(10, 'mono', 500);
            if (q.jobs.length === 0) {
              ctx.fillStyle = OS.C.faint;
              ctx.fillText('(Queue empty)', jx, y + 38);
            } else {
              q.jobs.forEach((job, idx) => {
                const tw = ctx.measureText(job).width;
                const isHead = (idx === 0);
                ctx.fillStyle = isHead ? OS.rgba(OS.C.accent, 0.22) : OS.rgba(OS.C.line, 0.4);
                ctx.strokeStyle = isHead ? OS.C.accent : OS.C.line;
                ctx.lineWidth = 1;
                ctx.roundRect(jx - 4, y + 24, tw + 8, 18, 4);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = isHead ? OS.C.ink : OS.C.muted;
                ctx.fillText(job, jx, y + 37);
                jx += tw + 14;
              });
            }
          });
        } else {
          // Render CFS Red-Black Tree & Task Vruntimes
          ctx.fillStyle = OS.C.sunk;
          ctx.strokeStyle = OS.C.line;
          ctx.roundRect(20, 16, w - 40, 130, 8);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = OS.C.accent;
          ctx.font = OS.font(12, 'mono', 600);
          ctx.fillText('CFS RED-BLACK TREE (Ordered by lowest virtual runtime vruntime)', 35, 38);

          // Render 3 Task nodes ordered by current vruntime
          const boxW = Math.min(180, (w - 90) / 3);
          cfsTasks.forEach((t, idx) => {
            const bx = 35 + idx * (boxW + 10);
            const isNext = (idx === 0);

            ctx.fillStyle = isNext ? OS.rgba(t.color, 0.2) : OS.rgba(OS.C.surface, 0.8);
            ctx.strokeStyle = isNext ? t.color : OS.C.line;
            ctx.lineWidth = isNext ? 2 : 1;
            ctx.roundRect(bx, 52, boxW, 80, 6);
            ctx.fill(); ctx.stroke();

            ctx.fillStyle = t.color;
            ctx.font = OS.font(boxW < 120 ? 9 : 11, 'mono', 600);
            const title = (boxW < 130) ? t.id.split(' ')[0] : t.id;
            ctx.fillText(title, bx + 8, 70);

            ctx.font = OS.font(boxW < 120 ? 9 : 10, 'mono', 400);
            ctx.fillStyle = OS.C.ink;
            ctx.fillText(boxW < 120 ? `Wt:${t.weight}` : `Weight: ${t.weight}`, bx + 8, 88);
            ctx.fillText(boxW < 120 ? `vrt:${t.vruntime.toFixed(1)}` : `vruntime: ${t.vruntime.toFixed(1)}ms`, bx + 8, 106);
            ctx.fillStyle = isNext ? OS.C.green : OS.C.muted;
            ctx.font = OS.font(boxW < 120 ? 8 : 9, 'mono', 600);
            ctx.fillText(isNext ? '◀ NEXT' : `Run: ${t.runtime}ms`, bx + 8, 122);
          });

          // Render execution history bar below
          const histY = 162;
          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 500);
          ctx.fillText('Execution History (Recent 10ms ticks):', 25, histY);

          let hx = 25;
          let hy = histY + 14;
          const maxBoxes = Math.max(1, Math.floor((w - 50) / 22));
          const recentHistory = cfsHistory.slice(-maxBoxes);
          recentHistory.forEach((item) => {
            ctx.fillStyle = item.color;
            ctx.roundRect(hx, hy, 18, 18, 3);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = OS.font(9, 'mono', 600);
            ctx.fillText(item.id.slice(0, 1), hx + 5, hy + 13);
            hx += 22;
          });
        }
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      if (mode === 'mlfq') {
        readout.innerHTML = `
          <b>MLFQ Active Action:</b> <span class="hl">${mlfqLastAction}</span><br>
          <span style="font-size:0.75rem; color:var(--muted)">Core Rules: 1. Priority(A) > Priority(B) runs A. | 2. Priority(A) == Priority(B) runs Round Robin. | 3. New jobs enter at top (Q0). | 4. Jobs using their quantum get demoted. | 5. Periodic Priority Boost moves all jobs to Q0 to prevent starvation.</span>
        `;
      } else {
        const totalRuntime = cfsTasks.reduce((acc, t) => acc + t.runtime, 0) || 1;
        const aPct = Math.round((cfsTasks.find(t => t.nice === -5).runtime / totalRuntime) * 100);
        const bPct = Math.round((cfsTasks.find(t => t.nice === 0).runtime / totalRuntime) * 100);
        const cPct = Math.round((cfsTasks.find(t => t.nice === 10).runtime / totalRuntime) * 100);

        readout.innerHTML = `
          <b>CFS Formula:</b> <code>vruntime += delta_exec × (1024 / weight)</code><br>
          • <b>Task A (nice -5, weight 3121):</b> Advances vruntime by only <b>3.3ms</b> per 10ms tick (~${aPct}% CPU share)<br>
          • <b>Task B (nice 0, weight 1024):</b> Advances vruntime by <b>10.0ms</b> per 10ms tick (~${bPct}% CPU share)<br>
          • <b>Task C (nice +10, weight 110):</b> Advances vruntime by <b>93.1ms</b> per 10ms tick (~${cPct}% CPU share)<br>
          <span style="font-size:0.75rem; color:var(--muted)">CFS always schedules the leftmost node (lowest vruntime). High-priority tasks advance vruntime slower, receiving proportionally more CPU cycles while maintaining complete mathematical fairness!</span>
        `;
      }
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
        <b>M (Modified):</b> Dirty cache line, only in this core, memory is stale. | 
        <b>E (Exclusive):</b> Clean cache line, only in this core. | 
        <b>S (Shared):</b> Clean cache line, present in multiple cores. | 
        <b>I (Invalid):</b> Cache line is stale and cannot be read without a bus transaction.
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 6. Thread Stacks & Context Switching
   * -------------------------------------------------------------------------- */
  OS.register('threadStacks', function (host) {
    let t0Depth = 2;
    let t1Depth = 1;
    let activeThread = 0;

    const controls = OS.controls(host);
    OS.button(controls, 'Switch Active Thread (Context Switch)', () => {
      activeThread = activeThread === 0 ? 1 : 0;
      render();
    }, { primary: true });
    OS.button(controls, 'Thread 0 Pushes Frame (Call)', () => {
      if (t0Depth < 4) t0Depth++;
      render();
    });
    OS.button(controls, 'Thread 1 Pushes Frame (Call)', () => {
      if (t1Depth < 4) t1Depth++;
      render();
    });
    OS.button(controls, 'Reset Stacks', () => {
      t0Depth = 2; t1Depth = 1; activeThread = 0;
      render();
    });

    const cv = OS.canvas(host, {
      height: 190,
      label: 'Thread stack layouts in shared address space',
      draw: (ctx, w, h) => {
        // Shared Heap & Code Box
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(25, 20, 160, 140, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.amber;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('SHARED ADDRESS SPACE', 35, 42);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('• Program Code (.text)', 35, 68);
        ctx.fillText('• Global Data (.bss)', 35, 90);
        ctx.fillText('• Shared Dynamic Heap', 35, 112);
        ctx.fillText('• Open File Descriptors', 35, 134);

        // Thread 0 Stack Box
        const t0X = 205;
        const colW = Math.min(140, (w - 240) / 2);
        ctx.fillStyle = activeThread === 0 ? OS.rgba(OS.C.accent, 0.15) : OS.C.sunk;
        ctx.strokeStyle = activeThread === 0 ? OS.C.accent : OS.C.line;
        ctx.lineWidth = activeThread === 0 ? 2 : 1;
        ctx.roundRect(t0X, 20, colW, 140, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = activeThread === 0 ? OS.C.accent : OS.C.muted;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('THREAD 0 STACK', t0X + 10, 42);
        for (let i = 0; i < t0Depth; i++) {
          ctx.fillStyle = OS.rgba(OS.C.accent, 0.2);
          ctx.fillRect(t0X + 10, 125 - i * 24, colW - 20, 20);
          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(9, 'mono', 500);
          ctx.fillText(`Frame ${i} [RSP]`, t0X + 14, 139 - i * 24);
        }

        // Thread 1 Stack Box
        const t1X = t0X + colW + 15;
        ctx.fillStyle = activeThread === 1 ? OS.rgba(OS.C.teal, 0.15) : OS.C.sunk;
        ctx.strokeStyle = activeThread === 1 ? OS.C.teal : OS.C.line;
        ctx.lineWidth = activeThread === 1 ? 2 : 1;
        ctx.roundRect(t1X, 20, colW, 140, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = activeThread === 1 ? OS.C.teal : OS.C.muted;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('THREAD 1 STACK', t1X + 10, 42);
        for (let i = 0; i < t1Depth; i++) {
          ctx.fillStyle = OS.rgba(OS.C.teal, 0.2);
          ctx.fillRect(t1X + 10, 125 - i * 24, colW - 20, 20);
          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(9, 'mono', 500);
          ctx.fillText(`Frame ${i} [RSP]`, t1X + 14, 139 - i * 24);
        }
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>Active Core Context:</b> Running <span class="hl">Thread ${activeThread}</span>.<br>
        Threads share the heap and code pointers within a single process address space, but maintain private stacks and register files (%rsp, %rip). Switching threads within a process avoids reloading the page table (CR3), keeping the TLB translation cache warm.
      `;
    }
    render();
  });

  /* --------------------------------------------------------------------------
   * 7. Interrupt Vector Table & Handling Pipeline
   * -------------------------------------------------------------------------- */
  OS.register('interruptPipeline', function (host) {
    const vectors = [
      { vec: 0, name: 'Timer Interrupt (IRQ 0)', type: 'Hardware IRQ', handler: 'timer_interrupt_handler()', phase: 'Preempts task for CFS' },
      { vec: 11, name: 'NIC Packet Received (IRQ 11)', type: 'Hardware IRQ', handler: 'e1000_intr() -> napi_schedule()', phase: 'Top-half acknowledges, bottom-half softirq polls packets' },
      { vec: 14, name: 'Page Fault Exception (#PF)', type: 'CPU Exception', handler: 'do_page_fault()', phase: 'Synchronous trap on invalid PTE' }
    ];
    let selectedVec = vectors[0];

    const controls = OS.controls(host);
    OS.select(controls, {
      id: 'vector-select',
      label: 'Trigger Interrupt Vector:',
      options: vectors.map(v => ({ label: `${v.name} (Vec ${v.vec})`, value: v.vec })),
      value: selectedVec.vec,
      onChange: (val) => {
        selectedVec = vectors.find(v => v.vec === parseInt(val)) || vectors[0];
        render();
      }
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Interrupt vector table lookup',
      draw: (ctx, w, h) => {
        // Step 1: Hardware Assertion
        ctx.fillStyle = OS.rgba(OS.C.rose, 0.15);
        ctx.strokeStyle = OS.C.rose;
        ctx.roundRect(25, 30, 150, 75, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.rose;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('1. HARDWARE IRQ', 35, 52);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Vector: ${selectedVec.vec}`, 35, 74);
        ctx.fillText(selectedVec.type, 35, 92);

        // Step 2: IDT Lookup
        const idtX = 200;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(idtX, 30, 160, 75, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('2. IDT TABLE (IDTR)', idtX + 10, 52);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`IDT[${selectedVec.vec}] → Gate`, idtX + 10, 74);
        ctx.fillText('Switches to Ring 0', idtX + 10, 92);

        // Step 3: ISR Handler
        const isrX = idtX + 185;
        ctx.fillStyle = OS.rgba(OS.C.green, 0.15);
        ctx.strokeStyle = OS.C.green;
        ctx.roundRect(isrX, 30, Math.min(220, w - isrX - 25), 75, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.green;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('3. KERNEL ISR HANDLER', isrX + 10, 52);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(selectedVec.handler.slice(0, 24), isrX + 10, 74);
        ctx.fillText('IRET / SYSRET return', isrX + 10, 92);
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>Interrupt Handling Pipeline:</b><br>
        • <b>Event:</b> <span class="hl">${selectedVec.name}</span> | • <b>Handler:</b> <code>${selectedVec.handler}</code><br>
        • <b>Action:</b> ${selectedVec.phase}
      `;
    }
    render();
  });

})();
