from http.server import BaseHTTPRequestHandler
import json
import time

def mock_simulate(verilog_code, testbench_code, top_module, top_testbench):
    """Mock simulation function that doesn't rely on external tools"""
    # Simulate processing time
    time.sleep(0.5)
    
    # Generate mock output
    output = f"Mock simulation of {top_module} with testbench {top_testbench}\n"
    output += "Simulation completed successfully\n"
    
    # Generate mock waveform data
    waveform_data = """
$date
    Date text. For example: June 26, 1989 10:05:41
$end
$version
    VCD generator version info
$end
$timescale
    1s
$end
$scope module top $end
$var wire 1 ! clk $end
$var wire 1 " rst $end
$var wire 8 # data $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
0!
0"
b00000000 #
$end
#100
1!
0"
b00000001 #
#200
0!
0"
b00000010 #
#300
1!
0"
b00000011 #
#400
0!
0"
b00000100 #
#500
1!
0"
b00000101 #
#600
0!
0"
b00000110 #
#700
1!
0"
b00000111 #
#800
0!
0"
b00001000 #
#900
1!
0"
b00001001 #
#1000
0!
0"
b00001010 #
"""
    
    return True, output, waveform_data

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))

        # Extract simulation parameters
        verilog_code = data.get('verilog_code', '')
        testbench_code = data.get('testbench_code', '')
        top_module = data.get('top_module', '')
        top_testbench = data.get('top_testbench', '')

        # Validate inputs
        if not all([verilog_code, testbench_code, top_module, top_testbench]):
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'error': 'Missing required fields'}
            self.wfile.write(json.dumps(response).encode())
            return

        # Run simulation
        try:
            success, output, waveform_data = mock_simulate(
                verilog_code,
                testbench_code,
                top_module,
                top_testbench
            )

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                'success': success,
                'output': output,
                'waveform_data': waveform_data
            }
            self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'error': str(e)}
            self.wfile.write(json.dumps(response).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers() 