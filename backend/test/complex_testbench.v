`timescale 1ns/1ps

module tb_complex_design;

    // Testbench signals
    reg clk;
    reg reset;
    wire [6:0] seg_display;
    wire [3:0] digit_select;
    wire [7:0] leds;
    wire buzzer;
    
    // Instantiate DUT
    top uut (
        .clk(clk),
        .reset(reset),
        .seg_display(seg_display),
        .digit_select(digit_select),
        .leds(leds),
        .buzzer(buzzer)
    );
    
    // Clock generation (100 MHz)
    initial begin
        clk = 0;
        forever #5 clk = ~clk; // 10ns period = 100MHz
    end
    
    // Test stimulus
    initial begin
        // Initialize signals
        reset = 1;
        
        // Dump signals for waveform viewing
        $dumpfile("tb_complex_design.vcd");
        $dumpvars(0, tb_complex_design);
        
        // Reset sequence
        #100;
        reset = 0;
        #50;
        
        // Test different scenarios
        $display("Starting complex design test...");
        
        // Test 1: Normal operation
        $display("Test 1: Normal operation");
        #10000; // Run for 10us
        
        // Test 2: Reset during operation
        $display("Test 2: Reset during operation");
        reset = 1;
        #100;
        reset = 0;
        #5000;
        
        // Test 3: Extended operation
        $display("Test 3: Extended operation");
        #50000; // Run for 50us
        
        // Test 4: Multiple resets
        $display("Test 4: Multiple resets");
        repeat (5) begin
            reset = 1;
            #50;
            reset = 0;
            #1000;
        end
        
        // Test 5: Long run
        $display("Test 5: Long run");
        #100000; // Run for 100us
        
        $display("Complex design test completed!");
        $finish;
    end
    
    // Monitor key signals
    always @(posedge clk) begin
        if (!reset) begin
            if (uut.counter == 4'd0) begin
                $display("Time %t: Counter reset to 0, State: %b, LEDs: %b", 
                         $time, uut.state, leds);
            end
            if (uut.counter == 4'd15) begin
                $display("Time %t: Counter reached 15, State: %b, Buzzer: %b", 
                         $time, uut.state, buzzer);
            end
        end
    end
    
    // Check for specific conditions
    always @(posedge clk) begin
        if (!reset && uut.state == 3'b011 && buzzer) begin
            $display("Time %t: BUZZ state detected with buzzer active", $time);
        end
    end

endmodule
