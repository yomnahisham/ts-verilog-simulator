# Professional DSP System Constraints for Nexys A7
# Clock Domain: 100 MHz System, 200 MHz DSP, 50 MHz UART
# Author: Professional FPGA Design

# =============================================================================
# CLOCK CONSTRAINTS
# =============================================================================

# Primary Clock (100 MHz)
set_property -dict { PACKAGE_PIN E3 IOSTANDARD LVCMOS33 } [get_ports { clk_100mhz }]
create_clock -add -name sys_clk_pin -period 10.000 -waveform {0 5} [get_ports { clk_100mhz }]

# Clock Domain Crossings
set_clock_groups -asynchronous -group [get_clocks sys_clk_pin] -group [get_clocks clk_dsp] -group [get_clocks clk_uart]

# =============================================================================
# RESET CONSTRAINTS
# =============================================================================

# Reset Button (BTNC)
set_property -dict { PACKAGE_PIN D9 IOSTANDARD LVCMOS33 } [get_ports { reset_n }]

# =============================================================================
# UART INTERFACE
# =============================================================================

# UART RX (PMOD JA1)
set_property -dict { PACKAGE_PIN G13 IOSTANDARD LVCMOS33 } [get_ports { uart_rx }]

# UART TX (PMOD JA2)
set_property -dict { PACKAGE_PIN B11 IOSTANDARD LVCMOS33 } [get_ports { uart_tx }]

# =============================================================================
# DDR3 MEMORY INTERFACE
# =============================================================================

# DDR3 Address
set_property -dict { PACKAGE_PIN F4 IOSTANDARD SSTL135 } [get_ports { ddr_addr[0] }]
set_property -dict { PACKAGE_PIN G4 IOSTANDARD SSTL135 } [get_ports { ddr_addr[1] }]
set_property -dict { PACKAGE_PIN H4 IOSTANDARD SSTL135 } [get_ports { ddr_addr[2] }]
set_property -dict { PACKAGE_PIN H5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[3] }]
set_property -dict { PACKAGE_PIN J5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[4] }]
set_property -dict { PACKAGE_PIN K5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[5] }]
set_property -dict { PACKAGE_PIN L5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[6] }]
set_property -dict { PACKAGE_PIN M5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[7] }]
set_property -dict { PACKAGE_PIN N5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[8] }]
set_property -dict { PACKAGE_PIN P5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[9] }]
set_property -dict { PACKAGE_PIN R5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[10] }]
set_property -dict { PACKAGE_PIN T5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[11] }]
set_property -dict { PACKAGE_PIN U5 IOSTANDARD SSTL135 } [get_ports { ddr_addr[12] }]

# DDR3 Bank Address
set_property -dict { PACKAGE_PIN V5 IOSTANDARD SSTL135 } [get_ports { ddr_ba[0] }]
set_property -dict { PACKAGE_PIN W5 IOSTANDARD SSTL135 } [get_ports { ddr_ba[1] }]
set_property -dict { PACKAGE_PIN Y5 IOSTANDARD SSTL135 } [get_ports { ddr_ba[2] }]

# DDR3 Control Signals
set_property -dict { PACKAGE_PIN AA5 IOSTANDARD SSTL135 } [get_ports { ddr_cas_n }]
set_property -dict { PACKAGE_PIN AB5 IOSTANDARD SSTL135 } [get_ports { ddr_cke }]
set_property -dict { PACKAGE_PIN AB6 IOSTANDARD SSTL135 } [get_ports { ddr_clk_n }]
set_property -dict { PACKAGE_PIN AA6 IOSTANDARD SSTL135 } [get_ports { ddr_clk_p }]
set_property -dict { PACKAGE_PIN AC5 IOSTANDARD SSTL135 } [get_ports { ddr_cs_n }]
set_property -dict { PACKAGE_PIN AD5 IOSTANDARD SSTL135 } [get_ports { ddr_odt }]
set_property -dict { PACKAGE_PIN AE5 IOSTANDARD SSTL135 } [get_ports { ddr_ras_n }]
set_property -dict { PACKAGE_PIN AF5 IOSTANDARD SSTL135 } [get_ports { ddr_reset_n }]
set_property -dict { PACKAGE_PIN AG5 IOSTANDARD SSTL135 } [get_ports { ddr_we_n }]

# DDR3 Data Mask
set_property -dict { PACKAGE_PIN AH5 IOSTANDARD SSTL135 } [get_ports { ddr_dm[0] }]
set_property -dict { PACKAGE_PIN AJ5 IOSTANDARD SSTL135 } [get_ports { ddr_dm[1] }]

# DDR3 Data Bus
set_property -dict { PACKAGE_PIN AK5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[0] }]
set_property -dict { PACKAGE_PIN AK6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[1] }]
set_property -dict { PACKAGE_PIN AL5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[2] }]
set_property -dict { PACKAGE_PIN AL6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[3] }]
set_property -dict { PACKAGE_PIN AM5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[4] }]
set_property -dict { PACKAGE_PIN AM6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[5] }]
set_property -dict { PACKAGE_PIN AN5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[6] }]
set_property -dict { PACKAGE_PIN AN6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[7] }]
set_property -dict { PACKAGE_PIN AP5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[8] }]
set_property -dict { PACKAGE_PIN AP6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[9] }]
set_property -dict { PACKAGE_PIN AR5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[10] }]
set_property -dict { PACKAGE_PIN AR6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[11] }]
set_property -dict { PACKAGE_PIN AT5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[12] }]
set_property -dict { PACKAGE_PIN AT6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[13] }]
set_property -dict { PACKAGE_PIN AU5 IOSTANDARD SSTL135 } [get_ports { ddr_dq[14] }]
set_property -dict { PACKAGE_PIN AU6 IOSTANDARD SSTL135 } [get_ports { ddr_dq[15] }]

# DDR3 Data Strobe
set_property -dict { PACKAGE_PIN AH6 IOSTANDARD SSTL135 } [get_ports { ddr_dqs_n[0] }]
set_property -dict { PACKAGE_PIN AJ6 IOSTANDARD SSTL135 } [get_ports { ddr_dqs_n[1] }]
set_property -dict { PACKAGE_PIN AH7 IOSTANDARD SSTL135 } [get_ports { ddr_dqs_p[0] }]
set_property -dict { PACKAGE_PIN AJ7 IOSTANDARD SSTL135 } [get_ports { ddr_dqs_p[1] }]

# =============================================================================
# STATUS AND CONTROL INTERFACE
# =============================================================================

# Status LEDs
set_property -dict { PACKAGE_PIN H17 IOSTANDARD LVCMOS33 } [get_ports { status_leds[0] }]
set_property -dict { PACKAGE_PIN K15 IOSTANDARD LVCMOS33 } [get_ports { status_leds[1] }]
set_property -dict { PACKAGE_PIN J13 IOSTANDARD LVCMOS33 } [get_ports { status_leds[2] }]
set_property -dict { PACKAGE_PIN N14 IOSTANDARD LVCMOS33 } [get_ports { status_leds[3] }]
set_property -dict { PACKAGE_PIN R18 IOSTANDARD LVCMOS33 } [get_ports { status_leds[4] }]
set_property -dict { PACKAGE_PIN V17 IOSTANDARD LVCMOS33 } [get_ports { status_leds[5] }]
set_property -dict { PACKAGE_PIN U17 IOSTANDARD LVCMOS33 } [get_ports { status_leds[6] }]
set_property -dict { PACKAGE_PIN U16 IOSTANDARD LVCMOS33 } [get_ports { status_leds[7] }]

# 7-Segment Display
set_property -dict { PACKAGE_PIN J17 IOSTANDARD LVCMOS33 } [get_ports { digit_select[0] }]
set_property -dict { PACKAGE_PIN J18 IOSTANDARD LVCMOS33 } [get_ports { digit_select[1] }]
set_property -dict { PACKAGE_PIN T9 IOSTANDARD LVCMOS33 } [get_ports { digit_select[2] }]
set_property -dict { PACKAGE_PIN J14 IOSTANDARD LVCMOS33 } [get_ports { digit_select[3] }]

set_property -dict { PACKAGE_PIN T10 IOSTANDARD LVCMOS33 } [get_ports { seg_display[0] }]
set_property -dict { PACKAGE_PIN R10 IOSTANDARD LVCMOS33 } [get_ports { seg_display[1] }]
set_property -dict { PACKAGE_PIN K16 IOSTANDARD LVCMOS33 } [get_ports { seg_display[2] }]
set_property -dict { PACKAGE_PIN K13 IOSTANDARD LVCMOS33 } [get_ports { seg_display[3] }]
set_property -dict { PACKAGE_PIN P15 IOSTANDARD LVCMOS33 } [get_ports { seg_display[4] }]
set_property -dict { PACKAGE_PIN T11 IOSTANDARD LVCMOS33 } [get_ports { seg_display[5] }]
set_property -dict { PACKAGE_PIN L18 IOSTANDARD LVCMOS33 } [get_ports { seg_display[6] }]

# Switches
set_property -dict { PACKAGE_PIN J15 IOSTANDARD LVCMOS33 } [get_ports { switches[0] }]
set_property -dict { PACKAGE_PIN L16 IOSTANDARD LVCMOS33 } [get_ports { switches[1] }]
set_property -dict { PACKAGE_PIN M13 IOSTANDARD LVCMOS33 } [get_ports { switches[2] }]
set_property -dict { PACKAGE_PIN R15 IOSTANDARD LVCMOS33 } [get_ports { switches[3] }]

# Buttons
set_property -dict { PACKAGE_PIN D9 IOSTANDARD LVCMOS33 } [get_ports { buttons[0] }]
set_property -dict { PACKAGE_PIN C9 IOSTANDARD LVCMOS33 } [get_ports { buttons[1] }]
set_property -dict { PACKAGE_PIN B9 IOSTANDARD LVCMOS33 } [get_ports { buttons[2] }]
set_property -dict { PACKAGE_PIN B8 IOSTANDARD LVCMOS33 } [get_ports { buttons[3] }]
set_property -dict { PACKAGE_PIN A8 IOSTANDARD LVCMOS33 } [get_ports { buttons[4] }]

# =============================================================================
# TIMING CONSTRAINTS
# =============================================================================

# Input/Output Delays
set_input_delay -clock sys_clk_pin -max 2.0 [get_ports { uart_rx }]
set_input_delay -clock sys_clk_pin -min 0.5 [get_ports { uart_rx }]
set_output_delay -clock sys_clk_pin -max 2.0 [get_ports { uart_tx }]
set_output_delay -clock sys_clk_pin -min 0.5 [get_ports { uart_tx }]

# DDR3 Timing Constraints
set_input_delay -clock ddr_clk_p -max 0.5 [get_ports { ddr_dq[*] }]
set_input_delay -clock ddr_clk_p -min -0.5 [get_ports { ddr_dq[*] }]
set_output_delay -clock ddr_clk_p -max 0.5 [get_ports { ddr_dq[*] }]
set_output_delay -clock ddr_clk_p -min -0.5 [get_ports { ddr_dq[*] }]

# =============================================================================
# PHYSICAL CONSTRAINTS
# =============================================================================

# Clock Region Constraints
set_property CLOCK_REGION X0Y0 [get_cells clk_wiz_0_inst]

# I/O Bank Constraints
set_property IOSTANDARD LVCMOS33 [get_ports { status_leds[*] }]
set_property IOSTANDARD LVCMOS33 [get_ports { seg_display[*] }]
set_property IOSTANDARD LVCMOS33 [get_ports { digit_select[*] }]
set_property IOSTANDARD LVCMOS33 [get_ports { switches[*] }]
set_property IOSTANDARD LVCMOS33 [get_ports { buttons[*] }]

# =============================================================================
# POWER CONSTRAINTS
# =============================================================================

# Power Domain Constraints
set_property POWER_DOMAIN VCCINT [get_cells fir_filter_16tap_inst]
set_property POWER_DOMAIN VCCINT [get_cells fft_64point_inst]
set_property POWER_DOMAIN VCCIO [get_cells uart_controller_inst]

# =============================================================================
# DEBUG CONSTRAINTS
# =============================================================================

# Debug Core Constraints
set_property C_CLK_INPUT_FREQ_HZ 100000000 [get_debug_cores dbg_hub]
set_property C_ENABLE_CLK_DIVIDER false [get_debug_cores dbg_hub]
set_property C_USER_SCAN_CHAIN 1 [get_debug_cores dbg_hub]
