

generate-chat-types:
	@echo "Generating types from TOML schemas..."
	@for schema in typegen/types/*.toml; do \
		echo "Processing $$schema..."; \
		python typegen/generate.py --schema "$$schema" --output chat-api/types --lang python --types-dir typegen/types; \
		python typegen/generate.py --schema "$$schema" --output chat-gateway/types --lang python --types-dir typegen/types; \
		python typegen/generate.py --schema "$$schema" --output chat-web/types --lang typescript --types-dir typegen/types; \
	done
	@echo "Done generating types!"