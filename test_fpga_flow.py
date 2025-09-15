#!/usr/bin/env python3
"""
Test script for the complete FPGA flow implementation
"""

import requests
import json
import time

# Backend URL
BACKEND_URL = "http://localhost:8001"

def test_health_endpoints():
    """Test all health endpoints"""
    print("Testing health endpoints...")
    
    endpoints = [
        "/health",
        "/api/v1/synthesis/health",
        "/api/v1/implementation/health", 
        "/api/v1/bitstream/health",
        "/api/v1/programming/health",
        "/api/v1/flow/health"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BACKEND_URL}{endpoint}")
            if response.status_code == 200:
                print(f"✓ {endpoint} - OK")
            else:
                print(f"✗ {endpoint} - Status: {response.status_code}")
        except Exception as e:
            print(f"✗ {endpoint} - Error: {str(e)}")

def test_supported_devices():
    """Test getting supported devices"""
    print("\nTesting supported devices...")
    
    endpoints = [
        "/api/v1/synthesis/devices",
        "/api/v1/implementation/devices",
        "/api/v1/bitstream/devices", 
        "/api/v1/programming/devices",
        "/api/v1/flow/devices"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BACKEND_URL}{endpoint}")
            if response.status_code == 200:
                data = response.json()
                print(f"✓ {endpoint} - OK")
                if 'supported_devices' in data:
                    families = list(data['supported_devices'].keys())
                    print(f"  Supported families: {families}")
            else:
                print(f"✗ {endpoint} - Status: {response.status_code}")
        except Exception as e:
            print(f"✗ {endpoint} - Error: {str(e)}")

def test_synthesis():
    """Test synthesis with a simple Verilog design"""
    print("\nTesting synthesis...")
    
    # Simple counter design
    verilog_code = """
module counter (
    input wire clk,
    input wire rst_n,
    output reg [3:0] count
);

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        count <= 4'b0000;
    end else begin
        count <= count + 1'b1;
    end
end

endmodule
"""
    
    payload = {
        "verilog_code": verilog_code,
        "top_module": "counter",
        "device_family": "xilinx_7series",
        "device_part": "xc7a35t"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/v1/synthesis/synthesize",
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✓ Synthesis - OK")
                print(f"  Device: {data.get('device_family')}/{data.get('device_part')}")
                if 'results' in data and 'statistics' in data['results']:
                    stats = data['results']['statistics']
                    print(f"  LUTs: {stats.get('lut_count', 0)}")
                    print(f"  FFs: {stats.get('ff_count', 0)}")
                return data
            else:
                print(f"✗ Synthesis - Failed: {data.get('output', 'Unknown error')}")
        else:
            print(f"✗ Synthesis - Status: {response.status_code}")
            print(f"  Response: {response.text}")
    except Exception as e:
        print(f"✗ Synthesis - Error: {str(e)}")
    
    return None

def test_implementation(synthesis_results):
    """Test implementation with synthesis results"""
    if not synthesis_results:
        print("\nSkipping implementation test - no synthesis results")
        return None
        
    print("\nTesting implementation...")
    
    netlist_json = synthesis_results.get('results', {}).get('netlist_json')
    if not netlist_json:
        print("✗ Implementation - No netlist from synthesis")
        return None
    
    payload = {
        "netlist_json": netlist_json,
        "top_module": "counter",
        "device_family": "xilinx_7series",
        "device_part": "xc7a35t"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/v1/implementation/implement",
            json=payload,
            timeout=120
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✓ Implementation - OK")
                if 'results' in data and 'utilization_report' in data['results']:
                    util = data['results']['utilization_report']
                    print(f"  LUT Usage: {util.get('lut_percentage', 0):.1f}%")
                    print(f"  FF Usage: {util.get('ff_percentage', 0):.1f}%")
                return data
            else:
                print(f"✗ Implementation - Failed: {data.get('output', 'Unknown error')}")
        else:
            print(f"✗ Implementation - Status: {response.status_code}")
            print(f"  Response: {response.text}")
    except Exception as e:
        print(f"✗ Implementation - Error: {str(e)}")
    
    return None

def test_complete_flow():
    """Test the complete FPGA flow"""
    print("\nTesting complete FPGA flow...")
    
    # Simple counter design
    verilog_code = """
module counter (
    input wire clk,
    input wire rst_n,
    output reg [3:0] count
);

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        count <= 4'b0000;
    end else begin
        count <= count + 1'b1;
    end
end

endmodule
"""
    
    payload = {
        "verilog_code": verilog_code,
        "top_module": "counter",
        "device_family": "xilinx_7series",
        "device_part": "xc7a35t",
        "program_fpga": False  # Don't actually program FPGA
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/v1/flow/complete",
            json=payload,
            timeout=300  # 5 minutes timeout for complete flow
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✓ Complete Flow - OK")
                results = data.get('results', {})
                print(f"  Stages completed: {results.get('stages_completed', [])}")
                print(f"  Stages failed: {results.get('stages_failed', [])}")
                print(f"  Overall success: {results.get('overall_success', False)}")
                return data
            else:
                print(f"✗ Complete Flow - Failed: {data.get('output', 'Unknown error')}")
        else:
            print(f"✗ Complete Flow - Status: {response.status_code}")
            print(f"  Response: {response.text}")
    except Exception as e:
        print(f"✗ Complete Flow - Error: {str(e)}")
    
    return None

def main():
    """Run all tests"""
    print("FPGA Flow Test Suite")
    print("=" * 50)
    
    # Test health endpoints
    test_health_endpoints()
    
    # Test supported devices
    test_supported_devices()
    
    # Test individual stages
    synthesis_results = test_synthesis()
    implementation_results = test_implementation(synthesis_results)
    
    # Test complete flow
    complete_flow_results = test_complete_flow()
    
    print("\n" + "=" * 50)
    print("Test Summary:")
    print(f"Synthesis: {'✓' if synthesis_results else '✗'}")
    print(f"Implementation: {'✓' if implementation_results else '✗'}")
    print(f"Complete Flow: {'✓' if complete_flow_results else '✗'}")
    
    if complete_flow_results:
        print("\n🎉 All tests passed! The FPGA flow is working correctly.")
    else:
        print("\n❌ Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()
