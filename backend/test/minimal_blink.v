module top(input clk, output reg led);
reg [1:0] counter;
always @(posedge clk) begin
    counter <= counter + 1;
    led <= counter[1];
end
endmodule
