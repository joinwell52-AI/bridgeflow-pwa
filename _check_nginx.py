# -*- coding: utf-8 -*-
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('120.55.164.16', username='root', password='xiaodian@ai@4009289299!', timeout=15)

# 查找 PWA 文件可能被哪个 location 处理
_, out, _ = ssh.exec_command("grep -n 'location\\|root\\|alias\\|try_files' /etc/nginx/sites-enabled/xiaoai | head -60")
print(out.read().decode())
ssh.close()
