# fcop-mcp

MCP (Model Context Protocol) server that exposes the [`fcop`](https://pypi.org/project/fcop/) library to Cursor, Claude Desktop, and other MCP clients.

```bash
pip install fcop-mcp
# or
uvx fcop-mcp
```

See the [FCoP repository](https://github.com/joinwell52-AI/FCoP) for protocol docs, ADRs, and the changelog.

**Note:** The `fcop` library and `fcop-mcp` are versioned separately; with `fcop-mcp` 0.6.1, install `fcop` **≥0.6.1** (see `pyproject.toml` `Requires-Dist`).

## License

MIT.
