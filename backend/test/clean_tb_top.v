`timescale 1ns/1ps
module tb_top;

    reg CLK100MHZ;
    wire LED;

    // Instantiate DUT (Device Under Test)
    top uut (
        .CLK100MHZ(CLK100MHZ),
        .LED(LED)
    );

    // Clock generation: 100 MHz → period = 10ns
    initial begin
        CLK100MHZ = 0;
        forever #5 CLK100MHZ = ~CLK100MHZ;
    end

    // Simulation control
    initial begin
        $dumpfile("tb_top.vcd"); // for GTKWave if using Icarus
        $dumpvars(0, tb_top);
        #1_000_000 $finish;      // run for some time then stop
    end

endmodule
