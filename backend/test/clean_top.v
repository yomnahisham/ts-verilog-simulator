module top (
    input  wire CLK100MHZ,   // 100 MHz clock from board
    output reg  LED          // On-board LED
);

    reg [26:0] counter = 0;

    always @(posedge CLK100MHZ) begin
        counter <= counter + 1;
        if (counter == 27'd100_000_000) begin // ~1 second
            counter <= 0;
            LED <= ~LED;
        end
    end

endmodule
