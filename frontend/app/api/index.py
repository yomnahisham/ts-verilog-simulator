from .main import app
from mangum import Mangum

# Handler for AWS Lambda
handler = Mangum(app) 