/* ==========================================================================
   Operating Systems, Cycle by Cycle — Systems & I/O Visualizations (viz-systems.js)
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 1. DMA (Direct Memory Access) Transfer Stepper
   * -------------------------------------------------------------------------- */
  OS.register('dmaTransfer', function (host) {
    const steps = [
      { name: '1. CPU Setup', desc: 'CPU programs DMA Controller with Source: Disk Controller, Destination: RAM 0x8000, Length: 4096 bytes.' },
      { name: '2. DMA Bus Master Transfer', desc: 'DMA controller takes control of system memory bus, transferring 4KB from disk buffer directly to RAM without CPU involvement.' },
      { name: '3. CPU Free for Other Work', desc: 'While DMA streams bytes, CPU context-switches and runs other ready processes at 100% throughput.' },
      { name: '4. Hardware Interrupt', desc: 'Transfer complete! DMA controller asserts IRQ line to Interrupt Controller. CPU handles ISR and wakes waiting process.' }
    ];
    let stepIndex = 0;

    const controls = OS.controls(host);
    OS.button(controls, 'Next DMA Step ▶', () => {
      stepIndex = (stepIndex + 1) % steps.length;
      render();
    }, { primary: true });
    OS.button(controls, 'Reset Flow', () => {
      stepIndex = 0;
      render();
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'DMA hardware transfer flow',
      draw: (ctx, w, h) => {
        const boxW = Math.min(130, (w - 100) / 4);
        const y = 35;

        // 1. CPU Box
        ctx.fillStyle = stepIndex === 0 || stepIndex === 2 ? OS.rgba(OS.C.accent, 0.15) : OS.C.sunk;
        ctx.strokeStyle = stepIndex === 0 || stepIndex === 2 ? OS.C.accent : OS.C.line;
        ctx.roundRect(25, y, boxW, 70, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(boxW < 80 ? 9 : 11, 'mono', 600);
        ctx.fillText('CPU', 32, y + 25);
        ctx.font = OS.font(boxW < 80 ? 8 : 10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(stepIndex === 2 ? 'Running' : 'Init I/O', 32, y + 45);

        // 2. DMA Controller Box
        const dmaX = 25 + boxW + 15;
        ctx.fillStyle = stepIndex === 1 ? OS.rgba(OS.C.amber, 0.18) : OS.C.sunk;
        ctx.strokeStyle = stepIndex === 1 ? OS.C.amber : OS.C.line;
        ctx.roundRect(dmaX, y, boxW, 70, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(boxW < 80 ? 8 : 10, 'mono', 600);
        ctx.fillText(boxW < 85 ? 'DMA' : 'DMA CTRL', dmaX + 6, y + 25);
        ctx.font = OS.font(boxW < 80 ? 8 : 10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Master', dmaX + 6, y + 45);

        // 3. RAM Box
        const ramX = dmaX + boxW + 15;
        ctx.fillStyle = stepIndex === 1 ? OS.rgba(OS.C.teal, 0.15) : OS.C.sunk;
        ctx.strokeStyle = stepIndex === 1 ? OS.C.teal : OS.C.line;
        ctx.roundRect(ramX, y, boxW, 70, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(boxW < 80 ? 9 : 10, 'mono', 600);
        ctx.fillText(boxW < 85 ? 'RAM' : 'RAM (0x8000)', ramX + 6, y + 25);
        ctx.font = OS.font(boxW < 80 ? 8 : 10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Stream', ramX + 6, y + 45);

        // 4. Disk Device Box
        const diskX = ramX + boxW + 15;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(diskX, y, boxW, 70, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(boxW < 80 ? 8 : 10, 'mono', 600);
        ctx.fillText(boxW < 85 ? 'DISK' : 'DISK CTRL', diskX + 6, y + 25);
        ctx.font = OS.font(boxW < 80 ? 8 : 10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('NVMe', diskX + 6, y + 45);

        // Progress Arrow
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText(`Current Step: ${steps[stepIndex].name}`, 25, 145);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>Direct Memory Access (DMA) Principle:</b><br>
        ${steps[stepIndex].desc}<br>
        <span style="font-size:0.75rem; color:var(--muted)">Without DMA, the CPU would waste 10,000s of cycles manually reading every single byte from device ports in a programmed I/O loop!</span>
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 2. Flash SSD Block Erasure & FTL Simulator
   * -------------------------------------------------------------------------- */
  OS.register('flashFtl', function (host) {
    let pages = [
      { id: 0, status: 'VALID', data: 'A' },
      { id: 1, status: 'VALID', data: 'B' },
      { id: 2, status: 'VALID', data: 'C' },
      { id: 3, status: 'INVALID', data: 'Old A' },
      { id: 4, status: 'EMPTY', data: '—' },
      { id: 5, status: 'EMPTY', data: '—' }
    ];

    const controls = OS.controls(host);
    OS.button(controls, 'Write Update (Page 0 → New A)', () => {
      // Flash cannot overwrite in place! Old page becomes INVALID, new page written to EMPTY slot
      pages[0].status = 'INVALID';
      pages[4].status = 'VALID';
      pages[4].data = 'New A';
      render();
    }, { primary: true });

    OS.button(controls, 'Trigger Garbage Collection (Trim)', () => {
      // GC copies valid pages (1, 2, 4) to new block and erases old block
      pages = [
        { id: 0, status: 'VALID', data: 'B' },
        { id: 1, status: 'VALID', data: 'C' },
        { id: 2, status: 'VALID', data: 'New A' },
        { id: 3, status: 'EMPTY', data: '—' },
        { id: 4, status: 'EMPTY', data: '—' },
        { id: 5, status: 'EMPTY', data: '—' }
      ];
      render();
    });

    const cv = OS.canvas(host, {
      height: 150,
      label: 'Flash memory block and pages',
      draw: (ctx, w, h) => {
        const slotW = 65;
        pages.forEach((p, i) => {
          const sx = 25 + i * (slotW + 10);
          ctx.fillStyle = p.status === 'VALID' ? OS.rgba(OS.C.teal, 0.15) : (p.status === 'INVALID' ? OS.rgba(OS.C.rose, 0.15) : OS.C.sunk);
          ctx.strokeStyle = p.status === 'VALID' ? OS.C.teal : (p.status === 'INVALID' ? OS.C.rose : OS.C.line);
          ctx.lineWidth = 1.5;
          ctx.roundRect(sx, 30, slotW, 65, 6);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(10, 'mono', 600);
          ctx.fillText(`Page ${p.id}`, sx + 8, 48);
          ctx.font = OS.font(12, 'mono', 500);
          ctx.fillText(p.data, sx + 8, 68);

          ctx.fillStyle = p.status === 'VALID' ? OS.C.teal : (p.status === 'INVALID' ? OS.C.rose : OS.C.faint);
          ctx.font = OS.font(9, 'mono', 600);
          ctx.fillText(p.status, sx + 8, 86);
        });
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>Flash Memory Asymmetry:</b> Read & write happen at the <b>page level (4KB)</b>, but erasure can only occur at the <b>block level (2–8MB)</b>.<br>
        The Flash Translation Layer (FTL) performs out-of-place writes to prevent slow block erasures on every write, managing wear-leveling and background garbage collection.
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 3. Ext4/xv6 Inode & Directory Navigator
   * -------------------------------------------------------------------------- */
  OS.register('inodeTree', function (host) {
    const paths = [
      { name: '/var/log/syslog', inode: 89, type: 'Regular File', size: '2.4 MB', blocks: '[Sector 1024..1536]' },
      { name: '/etc/passwd', inode: 14, type: 'Regular File', size: '1.8 KB', blocks: '[Sector 400]' },
      { name: '/home/alice', inode: 204, type: 'Directory', size: '4.0 KB', blocks: '[Sector 800]' }
    ];
    let selectedPath = paths[0];

    const controls = OS.controls(host);
    OS.select(controls, {
      id: 'path-select',
      label: 'Navigate File Path:',
      options: paths.map(p => ({ label: p.name, value: p.name })),
      value: selectedPath.name,
      onChange: (v) => {
        selectedPath = paths.find(p => p.name === v);
        render();
      }
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Inode traversal pathway',
      draw: (ctx, w, h) => {
        // Step 1: Root Inode
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.12);
        ctx.strokeStyle = OS.C.accent;
        ctx.lineWidth = 1.5;
        ctx.roundRect(25, 30, 130, 85, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('ROOT INODE (2)', 35, 50);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Type: Directory', 35, 72);
        ctx.fillText('Permissions: 755', 35, 92);

        // Step 2: Directory Table
        const dirX = 185;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(dirX, 30, 150, 85, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.amber;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('DIRECTORY DATA', dirX + 10, 50);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Mapping name → inode', dirX + 10, 72);
        ctx.fillText(`Target: Inode ${selectedPath.inode}`, dirX + 10, 92);

        // Step 3: Target Inode
        const fileX = dirX + 175;
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.12);
        ctx.strokeStyle = OS.C.teal;
        ctx.roundRect(fileX, 30, Math.min(200, w - fileX - 25), 85, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.teal;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText(`INODE ${selectedPath.inode}`, fileX + 10, 50);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Size: ${selectedPath.size}`, fileX + 10, 72);
        ctx.fillText(`Data: ${selectedPath.blocks}`, fileX + 10, 92);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>Path Resolution Flow:</b> In Unix, directories are simply special files containing tables of <code>(filename, inode_number)</code> pairs.<br>
        To open <code>${selectedPath.name}</code>, the VFS starts at Root Inode 2, walks each path component, and fetches the final inode metadata before accessing disk data sectors.
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 4. io_uring Dual Ring Buffer Simulator
   * -------------------------------------------------------------------------- */
  OS.register('ioUring', function (host) {
    let sqTail = 2;
    let cqHead = 1;

    const controls = OS.controls(host);
    OS.button(controls, 'Submit SQE (User Space: No Syscall!)', () => {
      sqTail = (sqTail + 1) % 6;
      render();
    }, { primary: true });

    OS.button(controls, 'Kernel Worker Reaps SQ & Posts CQE', () => {
      cqHead = (cqHead + 1) % 6;
      render();
    });

    const cv = OS.canvas(host, {
      height: 160,
      label: 'io_uring dual ring buffers',
      draw: (ctx, w, h) => {
        const ringW = Math.min(220, (w - 70) / 2);

        // SQ Ring (Submission Queue)
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.lineWidth = 1.5;
        ctx.roundRect(25, 20, ringW, 110, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('SUBMISSION QUEUE (SQ)', 35, 42);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Shared Ring Buffer (Mmap)', 35, 65);
        ctx.fillText(`Head: 0 · Tail: ${sqTail}`, 35, 88);
        ctx.fillText('Written by: User Space', 35, 110);

        // CQ Ring (Completion Queue)
        const cqX = w - 25 - ringW;
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.1);
        ctx.strokeStyle = OS.C.teal;
        ctx.lineWidth = 1.5;
        ctx.roundRect(cqX, 20, ringW, 110, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.teal;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('COMPLETION QUEUE (CQ)', cqX + 10, 42);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('Shared Ring Buffer (Mmap)', cqX + 10, 65);
        ctx.fillText(`Head: ${cqHead} · Tail: 4`, cqX + 10, 88);
        ctx.fillText('Written by: Kernel Space', cqX + 10, 110);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>io_uring Zero-Syscall Revolution:</b><br>
        Standard Linux I/O requires two system calls per operation (<code>read</code> and return), incurring costly hardware privilege mode switches.<br>
        With <code>io_uring</code>, the application and kernel share two lockless ring buffers in memory. Applications submit batch requests and reap completions with <b>zero system calls</b> when polling mode (<code>IORING_SETUP_SQPOLL</code>) is enabled!
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 5. Journaling File System Crash Simulator
   * -------------------------------------------------------------------------- */
  OS.register('journalCrash', function (host) {
    let phase = 'READY'; // READY, JOURNAL_WRITTEN, COMMITTED, CHECKPOINTED, CRASHED_PRE, CRASHED_POST, RECOVERED

    const controls = OS.controls(host);
    OS.button(controls, 'Write to Journal (TxB + Blocks)', () => {
      phase = 'JOURNAL_WRITTEN';
      render();
    });
    OS.button(controls, 'Crash Power (Before Commit)', () => {
      phase = 'CRASHED_PRE';
      render();
    });
    OS.button(controls, 'Commit Transaction (TxE)', () => {
      phase = 'COMMITTED';
      render();
    }, { primary: true });
    OS.button(controls, 'Crash Power (After Commit)', () => {
      phase = 'CRASHED_POST';
      render();
    });
    OS.button(controls, 'Run Recovery Replay (fsck/mount)', () => {
      phase = 'RECOVERED';
      render();
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Journaling write ahead logging and crash recovery',
      draw: (ctx, w, h) => {
        // Journal Area
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.lineWidth = 1.5;
        ctx.roundRect(25, 25, 230, 120, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('CONTIGUOUS JOURNAL (WAL)', 35, 48);

        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        const jTx = phase !== 'READY' && phase !== 'CRASHED_PRE';
        ctx.fillText(`[TxB: Begin] ${jTx ? '✓ Written' : '—'}`, 35, 75);
        ctx.fillText(`[Metadata + Data] ${jTx ? '✓ Written' : '—'}`, 35, 98);
        const jCommit = phase === 'COMMITTED' || phase === 'CRASHED_POST' || phase === 'RECOVERED';
        ctx.fillStyle = jCommit ? OS.C.green : OS.C.muted;
        ctx.font = OS.font(10, 'mono', 600);
        ctx.fillText(`[TxE: Commit Block] ${jCommit ? '✓ COMMITTED' : 'Not committed'}`, 35, 120);

        // Filesystem Storage Area
        const fsX = 275;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(fsX, 25, Math.min(260, w - fsX - 25), 120, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.amber;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('FINAL FILESYSTEM BLOCKS', fsX + 15, 48);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Inode: ${phase === 'RECOVERED' ? '✓ Updated' : 'Pending checkpoint'}`, fsX + 15, 75);
        ctx.fillText(`Data Bitmap: ${phase === 'RECOVERED' ? '✓ Updated' : 'Pending checkpoint'}`, fsX + 15, 98);
        ctx.fillText(`Data Sector: ${phase === 'RECOVERED' ? '✓ Written' : 'Pending checkpoint'}`, fsX + 15, 120);
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      if (phase === 'CRASHED_PRE') {
        readout.innerHTML = `<b style="color:var(--rose)">CRASH BEFORE COMMIT:</b> Power lost while writing journal. On reboot, kernel scans journal, sees no TxE commit block, and discards partial transaction. <b>Zero filesystem corruption!</b>`;
      } else if (phase === 'CRASHED_POST') {
        readout.innerHTML = `<b style="color:var(--amber)">CRASH AFTER COMMIT:</b> Power lost before checkpointing to final blocks. On reboot, kernel sees valid TxE commit block and simply replays the transaction. <b>Data guaranteed safe!</b>`;
      } else if (phase === 'RECOVERED') {
        readout.innerHTML = `<b style="color:var(--green)">RECOVERY COMPLETE:</b> Journal scanned and replayed in 0.2 seconds. Full-disk fsck avoided!`;
      } else {
        readout.innerHTML = `<b>Write-Ahead Logging:</b> Transactions are committed atomically to the journal before modifying fixed inode/bitmap structures.`;
      }
    }
    render();
  });

  /* --------------------------------------------------------------------------
   * 6. Container Namespaces & cgroups Isolation
   * -------------------------------------------------------------------------- */
  OS.register('containerMatrix', function (host) {
    let view = 'container';

    const controls = OS.controls(host);
    OS.segmented(controls, {
      label: 'Perspective',
      options: [
        { label: 'Container PID Namespace View', value: 'container' },
        { label: 'Host Kernel Global View', value: 'host' }
      ],
      value: view,
      onChange: (v) => { view = v; render(); }
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Container namespace and cgroup boundary',
      draw: (ctx, w, h) => {
        const isContainer = view === 'container';

        ctx.fillStyle = isContainer ? OS.rgba(OS.C.accent, 0.12) : OS.C.sunk;
        ctx.strokeStyle = isContainer ? OS.C.accent : OS.C.line;
        ctx.lineWidth = 2;
        ctx.roundRect(25, 25, w - 50, 120, 8);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = isContainer ? OS.C.accent : OS.C.ink;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText(isContainer ? 'CONTAINER ISOLATED VIEW (PID Namespace)' : 'HOST KERNEL GLOBAL VIEW', 35, 52);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        if (isContainer) {
          ctx.fillText('• PID 1: /usr/sbin/nginx (Application sees itself as init/root)', 35, 80);
          ctx.fillText('• Mount: / (Private overlayfs mount root, host files hidden)', 35, 102);
          ctx.fillText('• cgroups v2: cpu.max = 50000 100000 (Clamped to 50% CPU limit)', 35, 124);
        } else {
          ctx.fillText('• PID 4082: /usr/sbin/nginx (Real host PID)', 35, 80);
          ctx.fillText('• PID 1: /sbin/systemd (Real init system)', 35, 102);
          ctx.fillText('• Total Host Processes: 248 tasks running on bare metal kernel', 35, 124);
        }
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>Linux Container Architecture:</b> Containers are not hypervisors or VMs. 
        <b>Namespaces</b> restrict what a process can <i>see</i> (PID, network, mount points), while <b>cgroups v2</b> restrict what a process can <i>use</i> (CPU cores, memory, disk I/O).
      `;
    }
    render();
  });

  /* --------------------------------------------------------------------------
   * 7. In-Kernel Bytecode: eBPF Verifier & Hook Simulator
   * -------------------------------------------------------------------------- */
  OS.register('ebpfSim', function (host) {
    const progs = [
      { name: 'XDP Packet Counter (Safe)', status: 'PASS', desc: '14 instructions, bounded loop, pointer validated within packet range [data..data_end]. JIT compiled.' },
      { name: 'Out-Of-Bounds Memory Access (Unsafe)', status: 'REJECT', desc: 'Instruction 8 dereferences *(skb + 4096) without checking buffer length. Verifier halts load!' },
      { name: 'Unbounded While Loop (Unsafe)', status: 'REJECT', desc: 'Instruction 12 contains backward jump without guaranteed termination counter. Halts kernel load!' }
    ];
    let selected = progs[0];

    const controls = OS.controls(host);
    OS.select(controls, {
      id: 'ebpf-select',
      label: 'eBPF Program to Load:',
      options: progs.map(p => ({ label: p.name, value: p.name })),
      value: selected.name,
      onChange: (v) => {
        selected = progs.find(p => p.name === v);
        render();
      }
    });

    const cv = OS.canvas(host, {
      height: 170,
      label: 'eBPF kernel verifier state',
      draw: (ctx, w, h) => {
        const isPass = selected.status === 'PASS';
        ctx.fillStyle = isPass ? OS.rgba(OS.C.green, 0.12) : OS.rgba(OS.C.rose, 0.15);
        ctx.strokeStyle = isPass ? OS.C.green : OS.C.rose;
        ctx.lineWidth = 2;
        ctx.roundRect(25, 25, w - 50, 110, 8);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = isPass ? OS.C.green : OS.C.rose;
        ctx.font = OS.font(13, 'mono', 600);
        ctx.fillText(`KERNEL VERIFIER: [${isPass ? 'PROGRAM VERIFIED & JIT COMPILED' : 'LOAD REJECTED BY KERNEL'}]`, 35, 52);

        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(selected.desc, 35, 82);
        ctx.fillText(`Hook target: net/core/filter.c -> Attach Point: XDP / tc`, 35, 106);
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      if (selected.status === 'PASS') {
        readout.innerHTML = `<b style="color:var(--green)">eBPF Safety Proof:</b> The in-kernel verifier traversed all execution DAG paths and verified memory safety. JIT compiled into native machine code running at line rate.`;
      } else {
        readout.innerHTML = `<b style="color:var(--rose)">VERIFIER REJECTION:</b> Kernel blocked loading of unsafe bytecode. In-flight verifier guarantees that user eBPF programs can never crash or freeze the Linux kernel.`;
      }
    }
    render();
  });

  /* --------------------------------------------------------------------------
   * 8. Systems Latency Numbers Every Engineer Must Know
   * -------------------------------------------------------------------------- */
  OS.register('latencyPyramid', function (host) {
    const tiers = [
      { name: 'CPU Cycle', real: '0.5 ns', human: '1 second', color: OS.C.accent },
      { name: 'L1 Cache Reference', real: '1.0 ns', human: '2 seconds', color: OS.C.accent },
      { name: 'L2 Cache Reference', real: '4.0 ns', human: '8 seconds', color: OS.C.accent },
      { name: 'Main RAM Access', real: '100 ns', human: '3.3 minutes', color: OS.C.teal },
      { name: 'NVMe SSD I/O', real: '10 µs', human: '5.5 hours', color: OS.C.amber },
      { name: 'Mechanical Disk Seek', real: '10 ms', human: '7.7 months', color: OS.C.rose }
    ];

    const cv = OS.canvas(host, {
      height: 200,
      label: 'System hardware latency hierarchy',
      draw: (ctx, w, h) => {
        const rowH = 26;
        tiers.forEach((t, i) => {
          const y = 20 + i * (rowH + 4);
          ctx.fillStyle = OS.rgba(t.color, 0.15);
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 1;
          ctx.roundRect(25, y, w - 50, rowH, 4);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(w < 520 ? 10 : 11, 'mono', 600);
          ctx.fillText(t.name, 35, y + 17);

          if (w < 520) {
            ctx.fillStyle = t.color;
            ctx.font = OS.font(10, 'mono', 600);
            ctx.textAlign = 'right';
            ctx.fillText(t.real, w - 35, y + 17);
            ctx.textAlign = 'left';
          } else {
            ctx.fillStyle = t.color;
            ctx.font = OS.font(11, 'mono', 600);
            ctx.fillText(`Real: ${t.real}`, w * 0.44, y + 17);

            ctx.fillStyle = OS.C.muted;
            ctx.font = OS.font(10, 'sans', 500);
            ctx.fillText(`Human: ${t.human}`, w - 170, y + 17);
          }
        });
      }
    });

    const readout = OS.readout(host);
    readout.innerHTML = `
      <b>Normalized Intuition:</b> If a 1-cycle CPU operation takes <b>1 second</b>, an L1 cache hit takes 2 seconds, accessing main RAM is like waiting 3.3 minutes, an NVMe SSD access is like waiting 5.5 hours, and a rotational hard drive seek is like waiting <b>nearly 8 months</b>!
    `;
  });

})();
