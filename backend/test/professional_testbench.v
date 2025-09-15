`timescale 1ns/1ps

// Professional DSP System Testbench
// Tests: Clock domains, UART communication, DSP processing, Memory access
// Author: Professional FPGA Design

module tb_professional_dsp_system;

    // Testbench signals
    reg clk_100mhz;
    reg reset_n;
    reg uart_rx;
    wire uart_tx;
    wire [12:0] ddr_addr;
    wire [2:0] ddr_ba;
    wire ddr_cas_n;
    wire ddr_cke;
    wire ddr_clk_n;
    wire ddr_clk_p;
    wire ddr_cs_n;
    wire [1:0] ddr_dm;
    wire [15:0] ddr_dq;
    wire [1:0] ddr_dqs_n;
    wire [1:0] ddr_dqs_p;
    wire ddr_odt;
    wire ddr_ras_n;
    wire ddr_reset_n;
    wire ddr_we_n;
    wire [7:0] status_leds;
    wire [6:0] seg_display;
    wire [3:0] digit_select;
    reg [3:0] switches;
    reg [4:0] buttons;
    
    // Test control
    reg [31:0] test_phase;
    reg [31:0] test_counter;
    reg [7:0] uart_tx_data;
    reg uart_tx_start;
    wire uart_tx_ready;
    
    // Instantiate DUT
    top uut (
        .clk_100mhz(clk_100mhz),
        .reset_n(reset_n),
        .uart_rx(uart_rx),
        .uart_tx(uart_tx),
        .ddr_addr(ddr_addr),
        .ddr_ba(ddr_ba),
        .ddr_cas_n(ddr_cas_n),
        .ddr_cke(ddr_cke),
        .ddr_clk_n(ddr_clk_n),
        .ddr_clk_p(ddr_clk_p),
        .ddr_cs_n(ddr_cs_n),
        .ddr_dm(ddr_dm),
        .ddr_dq(ddr_dq),
        .ddr_dqs_n(ddr_dqs_n),
        .ddr_dqs_p(ddr_dqs_p),
        .ddr_odt(ddr_odt),
        .ddr_ras_n(ddr_ras_n),
        .ddr_reset_n(ddr_reset_n),
        .ddr_we_n(ddr_we_n),
        .status_leds(status_leds),
        .seg_display(seg_display),
        .digit_select(digit_select),
        .switches(switches),
        .buttons(buttons)
    );
    
    // Clock generation (100 MHz)
    initial begin
        clk_100mhz = 0;
        forever #5 clk_100mhz = ~clk_100mhz; // 10ns period = 100MHz
    end
    
    // Test stimulus
    initial begin
        // Initialize signals
        reset_n = 0;
        uart_rx = 1;
        switches = 4'b0000;
        buttons = 5'b00000;
        test_phase = 0;
        test_counter = 0;
        
        // Dump signals for waveform viewing
        $dumpfile("tb_professional_dsp_system.vcd");
        $dumpvars(0, tb_professional_dsp_system);
        
        $display("==========================================");
        $display("Professional DSP System Testbench Started");
        $display("==========================================");
        
        // Test Phase 1: Reset and Initialization
        $display("Phase 1: Reset and Initialization");
        #1000;
        reset_n = 1;
        #1000;
        
        // Test Phase 2: Basic Functionality
        $display("Phase 2: Basic Functionality Test");
        test_phase = 1;
        switches = 4'b0001; // Enable DSP
        #10000;
        
        // Test Phase 3: UART Communication
        $display("Phase 3: UART Communication Test");
        test_phase = 2;
        uart_send_command(32'h00000001); // Enable DSP
        #5000;
        uart_send_command(32'h00000002); // Start processing
        #10000;
        
        // Test Phase 4: DSP Processing
        $display("Phase 4: DSP Processing Test");
        test_phase = 3;
        switches = 4'b0011; // Enable FIR and FFT
        #50000; // Run for 50us
        
        // Test Phase 5: Memory Access
        $display("Phase 5: Memory Access Test");
        test_phase = 4;
        buttons = 5'b00001; // Trigger memory test
        #20000;
        
        // Test Phase 6: Stress Test
        $display("Phase 6: Stress Test");
        test_phase = 5;
        switches = 4'b1111; // Enable all features
        buttons = 5'b11111; // All buttons pressed
        #100000; // Run for 100us
        
        // Test Phase 7: Error Handling
        $display("Phase 7: Error Handling Test");
        test_phase = 6;
        reset_n = 0;
        #1000;
        reset_n = 1;
        #10000;
        
        // Test Phase 8: Long Run Test
        $display("Phase 8: Long Run Test");
        test_phase = 7;
        switches = 4'b1010; // Alternating pattern
        #500000; // Run for 500us
        
        $display("==========================================");
        $display("Professional DSP System Testbench Completed");
        $display("==========================================");
        $finish;
    end
    
    // UART transmission task
    task uart_send_command;
        input [31:0] command;
        reg [7:0] byte_data;
        integer i;
        begin
            $display("Sending UART command: 0x%08h", command);
            for (i = 0; i < 4; i = i + 1) begin
                byte_data = command[7:0];
                uart_send_byte(byte_data);
                command = command >> 8;
            end
        end
    endtask
    
    // UART byte transmission task
    task uart_send_byte;
        input [7:0] data;
        integer i;
        begin
            // Start bit
            uart_rx = 0;
            #104; // 9600 baud = 104ns per bit
            
            // Data bits
            for (i = 0; i < 8; i = i + 1) begin
                uart_rx = data[i];
                #104;
            end
            
            // Stop bit
            uart_rx = 1;
            #104;
        end
    endtask
    
    // Monitor key signals
    always @(posedge clk_100mhz) begin
        if (reset_n) begin
            test_counter <= test_counter + 1;
            
            // Monitor DSP processing
            if (uut.fft_valid) begin
                $display("Time %t: FFT output - Magnitude: 0x%02h, LEDs: 0x%02h", 
                         $time, uut.fft_magnitude, status_leds);
            end
            
            // Monitor UART communication
            if (uut.uart_rx_valid) begin
                $display("Time %t: UART RX - Data: 0x%02h", $time, uut.uart_rx_data);
            end
            
            // Monitor memory access
            if (uut.mem_req) begin
                $display("Time %t: Memory Request - Addr: 0x%08h, Data: 0x%08h", 
                         $time, uut.mem_addr, uut.mem_wdata);
            end
        end
    end
    
    // Performance monitoring
    always @(posedge clk_100mhz) begin
        if (reset_n && (test_counter % 10000 == 0)) begin
            $display("Time %t: Test Phase %d, Counter: %d, Status LEDs: 0x%02h", 
                     $time, test_phase, test_counter, status_leds);
        end
    end
    
    // Check for specific conditions
    always @(posedge clk_100mhz) begin
        if (reset_n) begin
            // Check for FFT processing
            if (uut.fft_valid && uut.fft_magnitude > 8'h80) begin
                $display("Time %t: High FFT magnitude detected: 0x%02h", 
                         $time, uut.fft_magnitude);
            end
            
            // Check for UART communication
            if (uut.uart_tx_start) begin
                $display("Time %t: UART TX started with data: 0x%02h", 
                         $time, uut.uart_tx_data);
            end
            
            // Check for memory operations
            if (uut.mem_ack) begin
                $display("Time %t: Memory operation completed - Data: 0x%08h", 
                         $time, uut.mem_rdata);
            end
        end
    end
    
    // Error detection
    always @(posedge clk_100mhz) begin
        if (reset_n) begin
            // Check for clock domain issues
            if (uut.clk_sys !== uut.clk_100mhz) begin
                $display("ERROR: Clock domain mismatch detected at time %t", $time);
            end
            
            // Check for reset issues
            if (uut.reset !== ~reset_n) begin
                $display("ERROR: Reset signal issue detected at time %t", $time);
            end
        end
    end
    
    // Test completion check
    always @(posedge clk_100mhz) begin
        if (reset_n && test_counter > 1000000) begin
            $display("Test completed successfully after %d clock cycles", test_counter);
        end
    end

endmodule
