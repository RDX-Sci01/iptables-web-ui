
<div align="center">
<a href="https://github.com/RDX-Sci01/iptables-web-ui">
    <img src="https://raw.githubusercontent.com/RDX-Sci01/iptables-web-ui/master/www/img/icon.png" width="128" />
</a>
</div>
<br>

# iptables-web-ui

A web-based manager for Iptables rules that uses the same syntax as the `iptables` CLI, featuring a well-organized table layout and allowing users to easily insert, delete, edit, and rearrange rules via drag-and-drop.

![Screenshot](https://raw.githubusercontent.com/RDX-Sci01/iptables-web-ui/master/assets/screenshot1.png)

## ⚠️ Security Notice

This application provides administrative access to firewall rules and should be treated with high security:

- **Do NOT expose to the internet without HTTPS/TLS encryption**
- **Use a strong, randomly generated password** (minimum 16+ characters)
- **Only accessible from trusted networks**
- **Requires NET_ADMIN capability** - runs with elevated privileges
- **Default session timeout**: 15 minutes for inactive tokens
- **Password hashing**: Uses bcrypt for secure password storage
- **Rate limiting**: Login attempts are limited to prevent brute force attacks

For security improvements and bug reports, please see [SECURITY.md](SECURITY.md) or contact the maintainer.

## Installation

**Docker CLI (with .env file for secure password storage):**
```bash
# 1. Create .env file with strong password
echo "WEBUI_PASSWORD=$(openssl rand -base64 32)" > .env
chmod 600 .env

# 2. Run container
docker run -d --name=iptables-web-ui \
    --network=host \
    -v data:/app/data \
    -v /etc/iptables:/etc/iptables \
    -v $(pwd)/.env:/app/.env \
    -e TZ=<timezone> \
    --env-file .env \
    ghcr.io/rdx-sci01/iptables-web-ui:latest
```

**Docker Compose (recommended):**
1. Copy [.env.example](.env.example) to `.env` and set `WEBUI_PASSWORD` with a strong password
2. Run: `docker-compose up -d`

See [docker-compose.yml](https://github.com/RDX-Sci01/iptables-web-ui/blob/master/docker-compose.yml) and [.env.example](.env.example) for all options.

## Configuration
| Variable | Description | Default |
| -------- | ----------- | ------- |
| DEFAULT_CHAIN | Chain that is selected when you open the interface. Format: `<ipv6 true/false>-<table>-<chain>` | `false-filter-INPUT` |
| FLUSH_ON_RESTORE | Clear all rules and chains on restore. This is the default behavior of iptables-restore, usually this should not be changed. Can be used to only save and restore selected tables to prevent messing up automatically generated chains like the ones from docker or libvirt (required additional steps when first loading the rules). | `true` |
| WEBUI_HOST | Ip address the web interface listens on. | *all* |
| WEBUI_PORT | Port the web interface listens on. | `8585` |
| WEBUI_PASSWORD | Super secret web interface password. | *none* |
| DATA_DIRECTORY | Path for saving keys and user configurations. | `/app/data` |
| DEBUG_MODE | Print executed iptables commands for debug purposes. | `false` |
