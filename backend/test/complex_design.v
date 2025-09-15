module top(
    input wire clk,
    input wire reset,
    output reg [6:0] seg_display,
    output reg [3:0] digit_select,
    output reg [7:0] leds,
    output reg buzzer
);

    // Internal signals
    reg [3:0] counter;
    reg [1:0] digit_counter;
    reg [15:0] clk_divider;
    reg [2:0] state;
    reg [7:0] pattern;
    
    // State machine states
    parameter IDLE = 3'b000;
    parameter COUNT = 3'b001;
    parameter DISPLAY = 3'b010;
    parameter BUZZ = 3'b011;
    parameter RESET_STATE = 3'b100;
    
    // Clock divider for slower operations
    always @(posedge clk) begin
        if (reset) begin
            clk_divider <= 0;
        end else begin
            clk_divider <= clk_divider + 1;
        end
    end
    
    // Main counter
    always @(posedge clk) begin
        if (reset) begin
            counter <= 0;
        end else if (clk_divider == 0) begin
            if (counter == 4'd15) begin
                counter <= 0;
            end else begin
                counter <= counter + 1;
            end
        end
    end
    
    // Digit selection for multiplexed display
    always @(posedge clk) begin
        if (reset) begin
            digit_counter <= 0;
        end else if (clk_divider[10:0] == 0) begin
            digit_counter <= digit_counter + 1;
        end
    end
    
    // State machine
    always @(posedge clk) begin
        if (reset) begin
            state <= IDLE;
        end else begin
            case (state)
                IDLE: begin
                    if (counter > 4'd5) begin
                        state <= COUNT;
                    end
                end
                COUNT: begin
                    if (counter == 4'd10) begin
                        state <= DISPLAY;
                    end
                end
                DISPLAY: begin
                    if (counter == 4'd15) begin
                        state <= BUZZ;
                    end
                end
                BUZZ: begin
                    if (counter == 4'd0) begin
                        state <= IDLE;
                    end
                end
                default: state <= IDLE;
            endcase
        end
    end
    
    // 7-segment decoder
    always @(*) begin
        case (counter)
            4'd0: seg_display = 7'b1000000; // 0
            4'd1: seg_display = 7'b1111001; // 1
            4'd2: seg_display = 7'b0100100; // 2
            4'd3: seg_display = 7'b0110000; // 3
            4'd4: seg_display = 7'b0011001; // 4
            4'd5: seg_display = 7'b0010010; // 5
            4'd6: seg_display = 7'b0000010; // 6
            4'd7: seg_display = 7'b1111000; // 7
            4'd8: seg_display = 7'b0000000; // 8
            4'd9: seg_display = 7'b0010000; // 9
            4'd10: seg_display = 7'b0001000; // A
            4'd11: seg_display = 7'b0000011; // b
            4'd12: seg_display = 7'b1000110; // C
            4'd13: seg_display = 7'b0100001; // d
            4'd14: seg_display = 7'b0000110; // E
            4'd15: seg_display = 7'b0001110; // F
            default: seg_display = 7'b1111111; // off
        endcase
    end
    
    // Digit selection
    always @(*) begin
        case (digit_counter)
            2'd0: digit_select = 4'b1110;
            2'd1: digit_select = 4'b1101;
            2'd2: digit_select = 4'b1011;
            2'd3: digit_select = 4'b0111;
            default: digit_select = 4'b1111;
        endcase
    end
    
    // LED pattern based on state
    always @(*) begin
        case (state)
            IDLE: pattern = 8'b00000001;
            COUNT: pattern = 8'b00000011;
            DISPLAY: pattern = 8'b00000111;
            BUZZ: pattern = 8'b00001111;
            default: pattern = 8'b00000000;
        endcase
    end
    
    // LED output
    always @(posedge clk) begin
        if (reset) begin
            leds <= 0;
        end else begin
            leds <= pattern | (counter << 4);
        end
    end
    
    // Buzzer control
    always @(posedge clk) begin
        if (reset) begin
            buzzer <= 0;
        end else begin
            buzzer <= (state == BUZZ) && clk_divider[15];
        end
    end

endmodule
