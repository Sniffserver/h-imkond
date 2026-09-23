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

echo "[1/6] Updating system packages & enabling SPI/I2C/UART..."
apt-get update -qq
apt-get install -y -qq python3-pip python3-venv git spidev-tools wpasupplicant hostapd python3-serial

# Enable SPI & I2C interfaces in Raspberry Pi boot config
if [ -f /boot/config.txt ]; then
  grep -q "dtparam=spi=on" /boot/config.txt || echo "dtparam=spi=on" >> /boot/config.txt
  grep -q "dtparam=i2c_arm=on" /boot/config.txt || echo "dtparam=i2c_arm=on" >> /boot/config.txt
  grep -q "enable_uart=1" /boot/config.txt || echo "enable_uart=1" >> /boot/config.txt
fi

echo "[2/6] Creating directories..."
mkdir -p /opt/hoimu
mkdir -p /etc/hoimu
mkdir -p /var/lib/hoimu
chmod 700 /etc/hoimu
chmod 700 /var/lib/hoimu

echo "[3/6] Setting up Python virtual environment..."
python3 -m venv /opt/hoimu/env
/opt/hoimu/env/bin/pip install --upgrade pip -q
/opt/hoimu/env/bin/pip install Flask spidev pyserial bleak requests -q

echo "[4/6] Initializing secure credentials (/etc/hoimu/secret.env)..."
if [ ! -f /etc/hoimu/secret.env ]; then
  PAIRING_SECRET=$(openssl rand -hex 16)
  cat <<EOF > /etc/hoimu/secret.env
# HÕIMU Pi Bridge Secret Credentials (Generated during installation)
HOIMU_PAIRING_SECRET=${PAIRING_SECRET}
HOIMU_LORA_DEVICE=/dev/spidev0.0
HOIMU_CONFIG=/etc/hoimu/config.json
HOIMU_DB=/var/lib/hoimu/sparse_map.db
HOIMU_CREDENTIALS=/var/lib/hoimu/paired_devices.json
EOF
  chmod 600 /etc/hoimu/secret.env
  echo "  -> Generated new randomized pairing secret."
else
  echo "  -> Existing /etc/hoimu/secret.env preserved."
fi

echo "[5/6] Deploying Daemon & System Configurations..."
cp -r ../../pi /opt/hoimu/pi
cp config.json /etc/hoimu/config.json
cp hoimu.service /etc/systemd/system/hoimu.service

chmod +x /opt/hoimu/pi/app/daemon.py

echo "[6/6] Enabling and starting hoimu.service..."
systemctl daemon-reload
systemctl enable hoimu.service
systemctl restart hoimu.service

echo "================================================================="
echo "   HÕIMU Pi Bridge Installation Complete!                       "
echo "   Gateway Health: http://192.168.4.1:8080/health               "
echo "   Dynamic Pairing Endpoint: http://192.168.4.1:8080/api/v1/pair/start"
echo "   Hardware Secrets: /etc/hoimu/secret.env (chmod 600)          "
echo "================================================================="
