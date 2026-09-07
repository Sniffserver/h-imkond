#!/usr/bin/env bash
# HÕIMU Pi Zero 2 W Mesh Daemon One-Line Installer
set -e

echo "================================================================="
echo "   HÕIMU Pi Zero 2 W Hardware Gateway & Solar Relay Installer    "
echo "================================================================="

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (e.g. sudo bash install.sh)"
  exit 1
fi

echo "[1/5] Updating system packages & enabling SPI/I2C..."
apt-get update -qq
apt-get install -y -qq python3-pip python3-venv git spidev-tools wpasupplicant hostapd

# Enable SPI & I2C interfaces in Raspberry Pi boot config
if [ -f /boot/config.txt ]; then
  grep -q "dtparam=spi=on" /boot/config.txt || echo "dtparam=spi=on" >> /boot/config.txt
  grep -q "dtparam=i2c_arm=on" /boot/config.txt || echo "dtparam=i2c_arm=on" >> /boot/config.txt
fi

echo "[2/5] Creating directories..."
mkdir -p /opt/hoimu
mkdir -p /etc/hoimu
mkdir -p /var/lib/hoimu

echo "[3/5] Setting up Python virtual environment..."
python3 -m venv /opt/hoimu/env
/opt/hoimu/env/bin/pip install --upgrade pip -q
/opt/hoimu/env/bin/pip install Flask spidev bleak requests -q

echo "[4/5] Deploying Daemon & System Configurations..."
cp hoimu_daemon.py /opt/hoimu/hoimu_daemon.py
cp config.json /etc/hoimu/config.json
cp hoimu.service /etc/systemd/system/hoimu.service

chmod +x /opt/hoimu/hoimu_daemon.py

echo "[5/5] Enabling and starting hoimu.service..."
systemctl daemon-reload
systemctl enable hoimu.service
systemctl restart hoimu.service

echo "================================================================="
echo "   HÕIMU Pi Bridge Installation Complete!                       "
echo "   Gateway Status: http://192.168.4.1:5000/health              "
echo "   ASCII Map View: http://192.168.4.1:5000/map/ascii          "
echo "================================================================="
