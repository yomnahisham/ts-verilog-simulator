module top (
    input wire CLK100MHZ,
    output reg LED
);

reg [26:0] counter;

always @(posedge CLK100MHZ) begin
    counter <= counter + 1;
    if (counter == 27'd100000000) begin
        counter <= 0;
        LED <= ~LED;
    end
end

endmodule
