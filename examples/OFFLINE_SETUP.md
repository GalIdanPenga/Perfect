# Perfect Python Client - Offline Installation

This directory contains everything needed to install and run the Perfect Python client on an offline computer.

## Contents

- `requirements.txt` - List of Python dependencies
- `wheels/` - Directory containing all dependency wheels (pre-downloaded)
- `setup_offline.bat` - Windows setup script
- `setup_offline.sh` - Linux/Mac setup script
- `example_flows.py` - Example client implementation

## Installation on Offline Computer

### Windows

1. Copy the entire `examples` folder to your offline computer
2. Open Command Prompt and navigate to the `examples` directory:
   ```cmd
   cd path\to\examples
   ```
3. Run the setup script:
   ```cmd
   setup_offline.bat
   ```
4. The script will:
   - Create a `.venv` virtual environment (if it doesn't exist)
   - Activate it
   - Install all dependencies from the `wheels` folder

### Linux/Mac

1. Copy the entire `examples` folder to your offline computer
2. Open a terminal and navigate to the `examples` directory:
   ```bash
   cd path/to/examples
   ```
3. Run the setup script:
   ```bash
   ./setup_offline.sh
   ```
4. The script will:
   - Create a `.venv` virtual environment (if it doesn't exist)
   - Activate it
   - Install all dependencies from the `wheels` folder

## Usage

After installation, activate the virtual environment and run the client:

### Windows
```cmd
.venv\Scripts\activate.bat
python example_flows.py
```

### Linux/Mac
```bash
source .venv/bin/activate
python example_flows.py
```

## Requirements

- **Python 3.8 or higher** must be installed on the offline computer
- Approximately **150 MB** of disk space for wheels and virtual environment

## Included Dependencies

The `wheels` folder contains all necessary packages:

- **requests** - HTTP client for API communication
- **schedule** - Task scheduling
- **pandas** - Data processing
- **numpy** - Numerical computing
- **scikit-learn** - Machine learning
- **matplotlib** - Data visualization
- **pytest** - Testing framework
- **black** - Code formatter
- **mypy** - Type checking

Plus all their transitive dependencies (35+ packages total).

## Troubleshooting

### "Python not found" error
Make sure Python 3.8+ is installed and added to your system PATH.

### Permission errors
On Linux/Mac, you may need to make the script executable:
```bash
chmod +x setup_offline.sh
```

### Virtual environment already exists
If you want to recreate the environment, delete the `.venv` folder first:
- Windows: `rmdir /s .venv`
- Linux/Mac: `rm -rf .venv`

Then run the setup script again.

## Updating Wheels (Online Computer)

To update the wheels with newer versions, run on an online computer:

```bash
cd examples
python -m pip download -r requirements.txt -d wheels/
```

This will download the latest compatible versions of all dependencies.
