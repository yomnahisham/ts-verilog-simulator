module top(
    input wire clk,
    input wire reset,
    output reg [7:0] leds,
    output reg [3:0] counter_out,
    output reg [1:0] state_out
);

    // Internal signals
    reg [7:0] counter;
    reg [1:0] state;
    reg [15:0] clk_div;
    reg [3:0] pattern;
    
    // State machine
    parameter IDLE = 2'b00;
    parameter COUNT = 2'b01;
    parameter DISPLAY = 2'b10;
    parameter RESET_ST = 2'b11;
    
    // Clock divider
    always @(posedge clk) begin
        if (reset) begin
            clk_div <= 0;
        end else begin
            clk_div <= clk_div + 1;
        end
    end
    
    // Main counter
    always @(posedge clk) begin
        if (reset) begin
            counter <= 0;
        end else if (clk_div == 0) begin
            if (counter == 8'd255) begin
                counter <= 0;
            end else begin
                counter <= counter + 1;
            end
        end
    end
    
    // State machine
    always @(posedge clk) begin
        if (reset) begin
            state <= IDLE;
        end else begin
            case (state)
                IDLE: begin
                    if (counter > 8'd50) begin
                        state <= COUNT;
                    end
                end
                COUNT: begin
                    if (counter > 8'd150) begin
                        state <= DISPLAY;
                    end
                end
                DISPLAY: begin
                    if (counter > 8'd200) begin
                        state <= RESET_ST;
                    end
                end
                RESET_ST: begin
                    if (counter > 8'd250) begin
                        state <= IDLE;
                    end
                end
                default: state <= IDLE;
            endcase
        end
    end
    
    // Pattern generation
    always @(*) begin
        case (state)
            IDLE: pattern = 4'b0001;
            COUNT: pattern = 4'b0011;
            DISPLAY: pattern = 4'b0111;
            RESET_ST: pattern = 4'b1111;
            default: pattern = 4'b0000;
        endcase
    end
    
    // LED output
    always @(posedge clk) begin
        if (reset) begin
            leds <= 0;
        end else begin
            leds <= {pattern, counter[3:0]};
        end
    end
    
    // Output assignments
    always @(posedge clk) begin
        if (reset) begin
            counter_out <= 0;
            state_out <= 0;
        end else begin
            counter_out <= counter[3:0];
            state_out <= state;
        end
    end

endmodule
