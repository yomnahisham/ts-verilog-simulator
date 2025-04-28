import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { verilog_code, testbench_code, top_module } = body;

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate different simulation outputs based on the top module
    let output = '';
    let vcdData = '';

    if (top_module === 'example_counter') {
      // Custom output for example_counter module
      output = `Simulation started at ${new Date().toISOString()}
Compiling design.v...
Compiling testbench.v...
Running simulation with top module: example_counter
Time=0 rst=1 count=00000000
Time=5 rst=1 count=00000000
Time=10 rst=1 count=00000000
Time=15 rst=1 count=00000000
Time=20 rst=1 count=00000000
Time=25 rst=1 count=00000000
Time=30 rst=1 count=00000000
Time=35 rst=1 count=00000000
Time=40 rst=1 count=00000000
Time=45 rst=1 count=00000000
Time=50 rst=1 count=00000000
Time=55 rst=1 count=00000000
Time=60 rst=1 count=00000000
Time=65 rst=1 count=00000000
Time=70 rst=1 count=00000000
Time=75 rst=1 count=00000000
Time=80 rst=1 count=00000000
Time=85 rst=1 count=00000000
Time=90 rst=1 count=00000000
Time=95 rst=1 count=00000000
Time=100 rst=0 count=00000000
Time=105 rst=0 count=00000001
Time=110 rst=0 count=00000010
Time=115 rst=0 count=00000011
Time=120 rst=0 count=00000100
Time=125 rst=0 count=00000101
Time=130 rst=0 count=00000110
Time=135 rst=0 count=00000111
Time=140 rst=0 count=00001000
Time=145 rst=0 count=00001001
Time=150 rst=0 count=00001010
Time=155 rst=0 count=00001011
Time=160 rst=0 count=00001100
Time=165 rst=0 count=00001101
Time=170 rst=0 count=00001110
Time=175 rst=0 count=00001111
Time=180 rst=0 count=00010000
Time=185 rst=0 count=00010001
Time=190 rst=0 count=00010010
Time=195 rst=0 count=00010011
Time=200 rst=0 count=00010100
Simulation completed successfully.`;

      // Custom VCD data for example_counter module
      vcdData = `$date
    Date text. For example: June 26, 1989 10:05:41
$end
$version
    VCD generator version info
$end
$timescale
    1ns
$end
$scope module example_counter_tb $end
$var wire 1 ! count[0] $end
$var wire 1 " count[1] $end
$var wire 1 # count[2] $end
$var wire 1 $ count[3] $end
$var wire 1 % count[4] $end
$var wire 1 & count[5] $end
$var wire 1 ' count[6] $end
$var wire 1 ( count[7] $end
$var reg 1 ) clk $end
$var reg 1 * rst $end
$upscope $end
$enddefinitions $end
#0
0!
0"
0#
0$
0%
0&
0'
0(
0)
1*
#5
1)
#10
0)
#15
1)
#20
0)
#25
1)
#30
0)
#35
1)
#40
0)
#45
1)
#50
0)
#55
1)
#60
0)
#65
1)
#70
0)
#75
1)
#80
0)
#85
1)
#90
0)
#95
1)
#100
0)
0*
#105
1!
#110
0!
1"
#115
0"
1#
#120
0#
1$
#125
0$
1%
#130
0%
1&
#135
0&
1'
#140
0'
1(
#145
0(
1!
#150
0!
1"
#155
0"
1#
#160
0#
1$
#165
0$
1%
#170
0%
1&
#175
0&
1'
#180
0'
1(
#185
0(
1!
#190
0!
1"
#195
0"
1#
#200
0#
1$`;
    } else {
      // Default output for other modules
      output = `Simulation started at ${new Date().toISOString()}
Compiling design.v...
Compiling testbench.v...
Running simulation with top module: ${top_module || 'auto-detected'}
Time=0 rst=1 count=00000000
Time=5 rst=1 count=00000000
Time=10 rst=1 count=00000000
Time=15 rst=1 count=00000000
Time=20 rst=1 count=00000000
Time=25 rst=1 count=00000000
Time=30 rst=1 count=00000000
Time=35 rst=1 count=00000000
Time=40 rst=1 count=00000000
Time=45 rst=1 count=00000000
Time=50 rst=1 count=00000000
Time=55 rst=1 count=00000000
Time=60 rst=1 count=00000000
Time=65 rst=1 count=00000000
Time=70 rst=1 count=00000000
Time=75 rst=1 count=00000000
Time=80 rst=1 count=00000000
Time=85 rst=1 count=00000000
Time=90 rst=1 count=00000000
Time=95 rst=1 count=00000000
Time=100 rst=0 count=00000000
Time=105 rst=0 count=00000001
Time=110 rst=0 count=00000010
Time=115 rst=0 count=00000011
Time=120 rst=0 count=00000100
Time=125 rst=0 count=00000101
Time=130 rst=0 count=00000110
Time=135 rst=0 count=00000111
Time=140 rst=0 count=00001000
Time=145 rst=0 count=00001001
Time=150 rst=0 count=00001010
Time=155 rst=0 count=00001011
Time=160 rst=0 count=00001100
Time=165 rst=0 count=00001101
Time=170 rst=0 count=00001110
Time=175 rst=0 count=00001111
Time=180 rst=0 count=00010000
Time=185 rst=0 count=00010001
Time=190 rst=0 count=00010010
Time=195 rst=0 count=00010011
Time=200 rst=0 count=00010100
Simulation completed successfully.`;

      // Default VCD data
      vcdData = `$date
    Date text. For example: June 26, 1989 10:05:41
$end
$version
    VCD generator version info
$end
$timescale
    1ns
$end
$scope module ${top_module ? `${top_module}_tb` : 'example_tb'} $end
$var wire 1 ! count[0] $end
$var wire 1 " count[1] $end
$var wire 1 # count[2] $end
$var wire 1 $ count[3] $end
$var wire 1 % count[4] $end
$var wire 1 & count[5] $end
$var wire 1 ' count[6] $end
$var wire 1 ( count[7] $end
$var reg 1 ) clk $end
$var reg 1 * rst $end
$upscope $end
$enddefinitions $end
#0
0!
0"
0#
0$
0%
0&
0'
0(
0)
1*
#5
1)
#10
0)
#15
1)
#20
0)
#25
1)
#30
0)
#35
1)
#40
0)
#45
1)
#50
0)
#55
1)
#60
0)
#65
1)
#70
0)
#75
1)
#80
0)
#85
1)
#90
0)
#95
1)
#100
0)
0*
#105
1!
#110
0!
1"
#115
0"
1#
#120
0#
1$
#125
0$
1%
#130
0%
1&
#135
0&
1'
#140
0'
1(
#145
0(
1!
#150
0!
1"
#155
0"
1#
#160
0#
1$
#165
0$
1%
#170
0%
1&
#175
0&
1'
#180
0'
1(
#185
0(
1!
#190
0!
1"
#195
0"
1#
#200
0#
1$`;
    }

    return NextResponse.json({
      output,
      waveform_data: vcdData,
    });
  } catch (error) {
    console.error('Error in mock simulate endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process simulation request' },
      { status: 500 }
    );
  }
} 