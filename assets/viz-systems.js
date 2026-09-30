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
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('CPU', 35, y + 25);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText(stepIndex === 2 ? 'Running Apps' : 'Initiates I/O', 35, y + 45);

        // 2. DMA Controller Box
        const dmaX = 25 + boxW + 15;
        ctx.fillStyle = stepIndex === 1 ? OS.rgba(OS.C.amber, 0.18) : OS.C.sunk;
        ctx.strokeStyle = stepIndex === 1 ? OS.C.amber : OS.C.line;
        ctx.roundRect(dmaX, y, boxW, 70, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('DMA CONTROLLER', dmaX + 10, y + 25);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Bus Master', dmaX + 10, y + 45);

        // 3. RAM Box
        const ramX = dmaX + boxW + 15;
        ctx.fillStyle = stepIndex === 1 ? OS.rgba(OS.C.teal, 0.15) : OS.C.sunk;
        ctx.strokeStyle = stepIndex === 1 ? OS.C.teal : OS.C.line;
        ctx.roundRect(ramX, y, boxW, 70, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('RAM (0x8000)', ramX + 10, y + 25);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Direct Stream', ramX + 10, y + 45);

        // 4. Disk Device Box
        const diskX = ramX + boxW + 15;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(diskX, y, boxW, 70, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('DISK CONTROLLER', diskX + 10, y + 25);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('NVMe / SATA', diskX + 10, y + 45);

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
   * 5. Systems Latency Numbers Every Engineer Must Know
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
          ctx.font = OS.font(11, 'mono', 600);
          ctx.fillText(t.name, 35, y + 17);

          ctx.fillStyle = t.color;
          ctx.font = OS.font(11, 'mono', 600);
          ctx.fillText(`Real: ${t.real}`, w / 2 - 40, y + 17);

          ctx.fillStyle = OS.C.muted;
          ctx.font = OS.font(10, 'sans', 500);
          ctx.fillText(`Human Scale: ${t.human}`, w - 170, y + 17);
        });
      }
    });

    const readout = OS.readout(host);
    readout.innerHTML = `
      <b>Normalized Intuition:</b> If a 1-cycle CPU operation takes <b>1 second</b>, an L1 cache hit takes 2 seconds, accessing main RAM is like waiting 3.3 minutes, an NVMe SSD access is like waiting 5.5 hours, and a rotational hard drive seek is like waiting <b>nearly 8 months</b>!
    `;
  });

})();
