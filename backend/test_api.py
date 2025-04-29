import requests
import sys

def test_api():
    base_url = "http://localhost:3000"
    
    # Test root endpoint
    try:
        response = requests.get(f"{base_url}/")
        print(f"Root endpoint response: {response.status_code}")
        print(f"Response body: {response.json()}")
    except Exception as e:
        print(f"Error testing root endpoint: {e}")
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health")
        print(f"Health endpoint response: {response.status_code}")
        print(f"Response body: {response.json()}")
    except Exception as e:
        print(f"Error testing health endpoint: {e}")

if __name__ == "__main__":
    test_api() 