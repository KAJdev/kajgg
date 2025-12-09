

generate-chat-types:
	@echo "Generating types from TOML schemas..."
	@for schema in typegen/types/*.toml; do \
		echo "Processing $$schema..."; \
		uv run typegen/generate.py --schema "$$schema" --output chat-api/chat_types --lang python --types-dir typegen/types; \
		uv run typegen/generate.py --schema "$$schema" --output chat-web/src/types --lang typescript --types-dir typegen/types; \
	done
	@echo "Done generating types!"