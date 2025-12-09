#!/usr/bin/env python3
"""
Generate types from TOML schema for Python and TypeScript.
"""
import argparse
import os
from typing import Any, Dict, List, Set, Tuple


def camel_to_snake(name: str) -> str:
    import re

    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


try:
    import tomllib  # Python 3.11+
except ImportError:
    try:
        import tomli as tomllib  # Fallback for older Python
    except ImportError:
        raise ImportError("TOML support required. Install with: pip install tomli")


def resolve_ref(
    schema: Dict[str, Any], ref: str, definitions: Dict[str, Any]
) -> Dict[str, Any]:
    """Resolve a $ref to the actual schema definition."""
    if ref.startswith("#/definitions/"):
        name = ref.split("/")[-1]
        return definitions.get(name, {})
    return {}


def get_type_from_schema(
    schema: Dict[str, Any],
    global_definitions: Dict[str, Any],
    visited: Set[str],
    language: str,
) -> str:
    """Convert a JSON Schema type to a Python or TypeScript type."""
    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]
        if ref_name in visited:
            return ref_name  # Avoid infinite recursion
        visited.add(ref_name)
        # Check if it's an enum - if so, return the enum name
        ref_schema = resolve_ref(schema, schema["$ref"], global_definitions)
        if ref_schema.get("type") == "string" and "enum" in ref_schema:
            return ref_name
        # For object types, return the type name directly
        if ref_schema.get("type") == "object" or "properties" in ref_schema:
            return ref_name
        # Otherwise, recurse to get the actual type
        return get_type_from_schema(ref_schema, global_definitions, visited, language)

    schema_type = schema.get("type")

    if schema_type == "string":
        if schema.get("format") == "date-time":
            return "datetime" if language == "python" else "Date"
        return "str" if language == "python" else "string"
    elif schema_type == "integer":
        return "int" if language == "python" else "number"
    elif schema_type == "number":
        return "float" if language == "python" else "number"
    elif schema_type == "boolean":
        return "bool" if language == "python" else "boolean"
    elif schema_type == "array":
        items = schema.get("items", {})
        item_type = get_type_from_schema(
            items, global_definitions, visited.copy(), language
        )
        if language == "python":
            return f"list[{item_type}]"
        else:
            return f"{item_type}[]"
    elif schema_type == "object":
        # This is a complex object, return the name if we have one
        return "dict" if language == "python" else "object"

    return "Any"


def generate_python_enum(name: str, enum_values: List[str]) -> str:
    """Generate a Python enum."""
    lines = ["from enum import Enum", "", "", f"class {name}(Enum):"]
    for value in enum_values:
        # Convert snake_case to UPPER_SNAKE_CASE
        key = value.upper()
        lines.append(f'    {key} = "{value}"')
    return "\n".join(lines) + "\n"


def update_python_package_root(base_dir: str):
    os.makedirs(base_dir, exist_ok=True)
    init_path = os.path.join(base_dir, "__init__.py")

    packages = []
    for entry in sorted(os.listdir(base_dir)):
        entry_path = os.path.join(base_dir, entry)
        package_init = os.path.join(entry_path, "__init__.py")
        if (
            os.path.isdir(entry_path)
            and os.path.exists(package_init)
            and not entry.startswith("_")
        ):
            packages.append(entry)

    lines = ["__all__ = ["]
    for package in packages:
        lines.append(f'    "{package}",')
    lines.append("]")
    lines.append("")

    with open(init_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def collect_imports(
    schema: Dict[str, Any],
    all_types: Dict[str, Dict[str, Any]],
    is_allof: bool = False,
) -> Tuple[Set[str], bool]:
    """Collect all imports needed for a type."""
    imports_needed = set()
    needs_datetime = False

    def check_schema(s: Dict[str, Any]):
        nonlocal needs_datetime
        if "$ref" in s:
            ref_name = s["$ref"].split("/")[-1]
            if ref_name in all_types:
                ref_type = all_types[ref_name]
                if ref_type.get("type") == "string" and "enum" in ref_type:
                    imports_needed.add(ref_name)
                elif ref_type.get("type") == "object":
                    imports_needed.add(ref_name)
        elif s.get("type") == "string" and s.get("format") == "date-time":
            needs_datetime = True
        elif s.get("type") == "array" and "items" in s:
            check_schema(s["items"])
        elif s.get("type") == "object" and "properties" in s:
            for prop_schema in s["properties"].values():
                check_schema(prop_schema)

    if is_allof:
        for item in schema.get("allOf", []):
            check_schema(item)
        check_schema(schema)
    else:
        for prop_schema in schema.get("properties", {}).values():
            check_schema(prop_schema)

    return imports_needed, needs_datetime


def generate_python_type(
    name: str,
    schema: Dict[str, Any],
    definitions: Dict[str, Any],
    all_types: Dict[str, Dict[str, Any]],
    current_subfolder: str = None,
    type_locations: Dict[str, str] = None,
) -> str:
    """Generate a Python dataclass from a JSON Schema definition."""
    lines = []

    # Check if this type extends another (allOf)
    has_allof = "allOf" in schema
    base_ref = None

    if has_allof:
        for item in schema.get("allOf", []):
            if "$ref" in item:
                base_ref = item["$ref"].split("/")[-1]
                break

    # Collect imports
    imports_needed, needs_datetime = collect_imports(schema, all_types, has_allof)

    # Generate imports
    lines.append("from dataclasses import dataclass")
    if needs_datetime:
        lines.append("from datetime import datetime")

    if base_ref:
        # Check if base is in a different subfolder
        base_location = type_locations.get(base_ref) if type_locations else None
        if base_location and base_location != current_subfolder:
            lines.append(
                f"from ..{base_location}.{camel_to_snake(base_ref)} import {base_ref}"
            )
        else:
            base_file = camel_to_snake(base_ref)
            lines.append(f"from .{base_file} import {base_ref}")
        imports_needed.discard(base_ref)  # Don't import base class twice

    for imp in sorted(imports_needed):
        imp_location = type_locations.get(imp) if type_locations else None
        if imp_location and imp_location != current_subfolder:
            # Cross-file import
            lines.append(f"from ..{imp_location}.{camel_to_snake(imp)} import {imp}")
        else:
            # Same file import
            imp_file = camel_to_snake(imp)
            lines.append(f"from .{imp_file} import {imp}")

    lines.append("")
    lines.append("")
    lines.append(f"@dataclass")

    if base_ref:
        lines.append(f"class {name}({base_ref}):")
    else:
        lines.append(f"class {name}:")

    # Add properties
    if has_allof:
        # For allOf, only add properties from the current schema (not the base)
        properties = schema.get("properties", {})
        required = set(schema.get("required", []))
    else:
        properties = schema.get("properties", {})
        required = set(schema.get("required", []))

    for prop_name, prop_schema in properties.items():
        # Add documentation comment if present
        if "doc" in prop_schema:
            doc_lines = prop_schema["doc"].split("\n")
            for doc_line in doc_lines:
                lines.append(f"    # {doc_line.strip()}")

        visited = set()
        prop_type = get_type_from_schema(prop_schema, all_types, visited, "python")

        # Handle enum references
        if "$ref" in prop_schema:
            ref_name = prop_schema["$ref"].split("/")[-1]
            if (
                ref_name in definitions
                and definitions[ref_name].get("type") == "string"
                and "enum" in definitions[ref_name]
            ):
                prop_type = ref_name

        prop_type += " | None = None"

        lines.append(f"    {prop_name}: {prop_type}")

    return "\n".join(lines) + "\n"


def generate_typescript_enum(name: str, enum_values: List[str]) -> str:
    """Generate a TypeScript enum."""
    lines = [f"export enum {name} {{"]
    for value in enum_values:
        key = value.upper()
        lines.append(f'    {key} = "{value}",')
    lines.append("}")
    return "\n".join(lines) + "\n"


def generate_python_union(
    type_names: List[str],
    current_subfolder: str = None,
) -> str:
    """Generate a simple Python union type."""
    lines = []

    # Import all the union member types
    for type_name in sorted(type_names):
        type_file = camel_to_snake(type_name)
        lines.append(f"from .{type_file} import {type_name}")

    lines.append("")
    lines.append("")

    # Simple union of types
    union_parts = [type_name for type_name in sorted(type_names)]

    union_name = "Union"  # Default name, will be replaced by caller
    lines.append(f"{union_name} = {' | '.join(union_parts)}")

    return "\n".join(lines) + "\n"


def generate_typescript_union(
    type_names: List[str],
    current_subfolder: str = None,
) -> str:
    """Generate a simple TypeScript union type."""
    lines = []

    # Import all the union member types
    for type_name in sorted(type_names):
        type_file = type_name.lower()
        lines.append(f'import type {{ {type_name} }} from "./{type_file}";')

    lines.append("")

    # Simple union of types
    union_parts = [f"  | {type_name}" for type_name in sorted(type_names)]

    union_name = "Union"  # Default name, will be replaced by caller
    lines.append(f"export type {union_name} =")
    # First variant without the leading |
    if union_parts:
        first = union_parts[0].replace("  | ", "  ")
        lines.append(first)
        for part in union_parts[1:]:
            lines.append(part)
    lines.append(";")

    return "\n".join(lines) + "\n"


def generate_typescript_type(
    name: str,
    schema: Dict[str, Any],
    definitions: Dict[str, Any],
    all_types: Dict[str, Dict[str, Any]],
    current_subfolder: str = None,
    type_locations: Dict[str, str] = None,
) -> str:
    """Generate a TypeScript type from a JSON Schema definition."""
    lines = []

    # Collect imports
    imports_needed = set()

    # Check if this type extends another (allOf)
    if "allOf" in schema:
        base_ref = None
        for item in schema["allOf"]:
            if "$ref" in item:
                base_ref = item["$ref"].split("/")[-1]
                imports_needed.add(base_ref)
                break

        properties = {}
        for item in schema.get("allOf", []):
            if "properties" in item:
                properties.update(item["properties"])
        properties.update(schema.get("properties", {}))
    else:
        properties = schema.get("properties", {})

    # Find all referenced types
    def collect_refs(s: Dict[str, Any]):
        if "$ref" in s:
            ref_name = s["$ref"].split("/")[-1]
            if ref_name in all_types:
                imports_needed.add(ref_name)
        elif s.get("type") == "array" and "items" in s:
            collect_refs(s["items"])
        elif s.get("type") == "object" and "properties" in s:
            for prop_schema in s["properties"].values():
                collect_refs(prop_schema)

    for prop_name, prop_schema in properties.items():
        collect_refs(prop_schema)

    # Generate imports
    for imp in sorted(imports_needed):
        imp_location = type_locations.get(imp) if type_locations else None
        if imp_location and imp_location != current_subfolder:
            # Cross-file import
            lines.append(
                f'import type {{ {imp} }} from "../{imp_location}/{imp.lower()}";'
            )
        else:
            # Same file import
            imp_file = imp.lower()
            lines.append(f'import type {{ {imp} }} from "./{imp_file}";')

    if imports_needed:
        lines.append("")

    # Generate type definition
    if "allOf" in schema:
        base_ref = None
        for item in schema.get("allOf", []):
            if "$ref" in item:
                base_ref = item["$ref"].split("/")[-1]
                break

        if base_ref:
            lines.append(f"export type {name} = {base_ref} & {{")
            # For allOf, only include properties from the current schema
            properties = schema.get("properties", {})
            required = set(schema.get("required", []))
        else:
            lines.append(f"export type {name} = {{")
            required = set(schema.get("required", []))
            # Merge required from allOf items
            for item in schema.get("allOf", []):
                if "required" in item:
                    required.update(item["required"])
            required.update(schema.get("required", []))
    else:
        lines.append(f"export type {name} = {{")
        required = set(schema.get("required", []))

    for prop_name, prop_schema in properties.items():
        visited = set()
        prop_type = get_type_from_schema(prop_schema, all_types, visited, "typescript")

        # Handle enum references
        if "$ref" in prop_schema:
            ref_name = prop_schema["$ref"].split("/")[-1]
            if (
                ref_name in definitions
                and definitions[ref_name].get("type") == "string"
                and "enum" in definitions[ref_name]
            ):
                prop_type = ref_name

        optional = "" if prop_name in required else "?"

        # Add JSDoc comment if documentation is present
        if "doc" in prop_schema:
            doc_text = prop_schema["doc"].replace("*/", "* /")  # Escape JSDoc end
            lines.append(f"    /** {doc_text} */")

        lines.append(f"    {prop_name}{optional}: {prop_type};")

    lines.append("}")
    return "\n".join(lines) + "\n"


def generate_python_discriminated_union(
    type_names: List[str],
    discriminator_enum: str,
    type_to_enum_map: Dict[str, str],
    discriminator_field: str,
    data_field: str,
    union_name: str,
    current_subfolder: str = None,
) -> str:
    """Generate a Python discriminated union type."""
    lines = []

    # Import discriminator enum
    lines.append(
        f"from .{camel_to_snake(discriminator_enum)} import {discriminator_enum}"
    )

    # Import all the union member types
    for type_name in sorted(type_names):
        type_file = camel_to_snake(type_name)
        lines.append(f"from .{type_file} import {type_name}")

    lines.append("")
    lines.append("")

    # Generate discriminated union structure
    union_parts = []
    for type_name in sorted(type_names):
        enum_value = type_to_enum_map.get(type_name, type_name.upper())
        union_parts.append(
            f'{{"{discriminator_field}": {discriminator_enum}.{enum_value}, "{data_field}": {type_name}}}'
        )

    lines.append(f"{union_name} = {' | '.join(union_parts)}")

    return "\n".join(lines) + "\n"


def generate_typescript_discriminated_union(
    type_names: List[str],
    discriminator_enum: str,
    type_to_enum_map: Dict[str, str],
    discriminator_field: str,
    data_field: str,
    union_name: str,
    current_subfolder: str = None,
) -> str:
    """Generate a TypeScript discriminated union type."""
    lines = []

    # Import discriminator enum
    lines.append(
        f'import {{ {discriminator_enum} }} from "./{discriminator_enum.lower()}";'
    )

    # Import all the union member types
    for type_name in sorted(type_names):
        type_file = type_name.lower()
        lines.append(f'import {{ {type_name} }} from "./{type_file}";')

    lines.append("")

    # Generate discriminated union structure
    union_parts = []
    for type_name in sorted(type_names):
        enum_value = type_to_enum_map.get(type_name, type_name.upper())
        union_parts.append(
            f"  | {{ {discriminator_field}: {discriminator_enum}.{enum_value}; {data_field}: {type_name} }}"
        )

    lines.append(f"export type {union_name} =")
    # First variant without the leading |
    if union_parts:
        first = union_parts[0].replace("  | ", "  ")
        lines.append(first)
        for part in union_parts[1:]:
            lines.append(part)
    lines.append(";")

    return "\n".join(lines) + "\n"


def convert_toml_to_json_schema(toml_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert TOML schema structure to JSON Schema format."""
    definitions = {}
    unions = {}  # Store union definitions

    # Extract definitions from TOML structure
    # Support both root-level types and types under "definitions"
    if "definitions" in toml_data:
        toml_defs = toml_data.get("definitions", {})
        toml_unions = toml_data.get("Union", {})
    else:
        # Types are at root level - filter out special keys
        toml_defs = {
            k: v
            for k, v in toml_data.items()
            if isinstance(v, dict) and not k.startswith("_") and k != "Union"
        }
        toml_unions = toml_data.get("Union", {})

    for name, defn in toml_defs.items():
        converted = {}

        # Copy type
        if "type" in defn:
            converted["type"] = defn["type"]

        # Handle enum
        if "enum" in defn:
            converted["enum"] = defn["enum"]

        # Handle properties - TOML nested tables create nested dicts
        if "properties" in defn:
            converted["properties"] = {}
            for prop_name, prop_def in defn["properties"].items():
                prop_converted = {}

                # Check if this property has nested items (for arrays)
                if "items" in prop_def:
                    prop_converted["type"] = "array"
                    items_def = prop_def["items"]
                    if isinstance(items_def, dict) and "ref" in items_def:
                        prop_converted["items"] = {
                            "$ref": f"#/definitions/{items_def['ref']}"
                        }
                    else:
                        prop_converted["items"] = items_def
                else:
                    # Regular property
                    if "type" in prop_def:
                        prop_converted["type"] = prop_def["type"]
                    if "format" in prop_def:
                        prop_converted["format"] = prop_def["format"]
                    if "ref" in prop_def:
                        prop_converted["$ref"] = f"#/definitions/{prop_def['ref']}"

                # Handle documentation
                if "doc" in prop_def:
                    prop_converted["doc"] = prop_def["doc"]
                elif "description" in prop_def:
                    prop_converted["doc"] = prop_def["description"]

                converted["properties"][prop_name] = prop_converted

        # Handle required fields
        if "required" in defn:
            converted["required"] = defn["required"]

        # Handle allOf
        if "allOf" in defn:
            converted["allOf"] = []
            for item in defn["allOf"]:
                if isinstance(item, dict) and "ref" in item:
                    converted["allOf"].append({"$ref": f"#/definitions/{item['ref']}"})

        definitions[name] = converted

    # Extract union definitions
    unions = {}
    if "Union" in toml_data:
        unions = toml_data["Union"]

    return {"definitions": definitions, "unions": unions}


def load_all_schemas(types_dir: str) -> Dict[str, Dict[str, Any]]:
    """Load all TOML schemas and return a global definitions map with file locations."""
    global_definitions = {}
    type_locations = {}  # Track which file each type comes from

    if not os.path.exists(types_dir):
        return global_definitions, type_locations

    for filename in os.listdir(types_dir):
        if not filename.endswith(".toml"):
            continue

        schema_path = os.path.join(types_dir, filename)
        subfolder = os.path.splitext(filename)[0]

        with open(schema_path, "rb") as f:
            toml_data = tomllib.load(f)

        schema = convert_toml_to_json_schema(toml_data)
        definitions = schema.get("definitions", {})

        # Add to global definitions and track locations
        for type_name, defn in definitions.items():
            global_definitions[type_name] = defn
            type_locations[type_name] = subfolder

    return global_definitions, type_locations


def generate_types(
    schema_path: str,
    output_dir: str,
    language: str,
    global_definitions: Dict[str, Any] = None,
    type_locations: Dict[str, str] = None,
):
    """Generate types from TOML schema."""
    if schema_path.endswith(".toml"):
        with open(schema_path, "rb") as f:
            toml_data = tomllib.load(f)
        schema = convert_toml_to_json_schema(toml_data)
    else:
        # Fallback for JSON if needed
        import json

        with open(schema_path, "r", encoding="utf-8") as f:
            schema = json.load(f)

    definitions = schema.get("definitions", {})
    unions = schema.get("unions", {})

    # Use global definitions if provided (for cross-file refs)
    if global_definitions is None:
        global_definitions = definitions
    if type_locations is None:
        type_locations = {}

    # Extract subfolder name from schema path
    # If schema is in a types/ subdirectory, use the filename (without .toml) as subfolder
    # e.g., typegen/types/models.toml -> models
    schema_dir = os.path.dirname(os.path.abspath(schema_path))
    schema_basename = os.path.splitext(os.path.basename(schema_path))[0]

    # Check if we're in a types/ subdirectory
    if os.path.basename(schema_dir) == "types":
        # File is directly in a types/ directory, use filename as subfolder
        subfolder = schema_basename
    else:
        # No subfolder, use root
        subfolder = None

    base_output_dir = output_dir
    target_output_dir = base_output_dir

    # Create output directory with subfolder if needed
    if subfolder:
        target_output_dir = os.path.join(base_output_dir, subfolder)

    os.makedirs(target_output_dir, exist_ok=True)

    # Clear existing files in this subfolder only
    if os.path.exists(target_output_dir):
        for file in os.listdir(target_output_dir):
            if file.endswith((".py", ".pyi", ".ts")):
                os.remove(os.path.join(target_output_dir, file))

    # Determine order: enums first, then base types, then derived types
    enums = {}
    types = {}

    for name, defn in definitions.items():
        if defn.get("type") == "string" and "enum" in defn:
            enums[name] = defn
        else:
            types[name] = defn

    py_exports: List[Tuple[str, str]] = []
    ts_exports: List[Tuple[str, str]] = []

    # Generate enums
    for name, defn in enums.items():
        enum_values = defn.get("enum", [])
        if language == "python":
            content = generate_python_enum(name, enum_values)
            ext = ".py"
            file_base = camel_to_snake(name)
            py_exports.append((file_base, name))
        else:
            content = generate_typescript_enum(name, enum_values)
            ext = ".ts"
            file_base = name.lower()
            ts_exports.append((file_base, name))

        output_path = os.path.join(target_output_dir, file_base + ext)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

    # Generate types
    all_types = {**enums, **types}
    # Merge with global definitions for cross-file refs
    all_types = {**global_definitions, **all_types}

    # Generate all types normally
    for name, defn in types.items():
        if language == "python":
            content = generate_python_type(
                name, defn, global_definitions, all_types, subfolder, type_locations
            )
            ext = ".py"
            file_base = camel_to_snake(name)
            py_exports.append((file_base, name))
        else:
            content = generate_typescript_type(
                name, defn, global_definitions, all_types, subfolder, type_locations
            )
            ext = ".ts"
            file_base = name.lower()
            ts_exports.append((file_base, name))

        output_path = os.path.join(target_output_dir, file_base + ext)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

    # Generate unions defined in schema
    for union_name, union_def in unions.items():
        union_types = union_def.get("types", [])
        if not union_types:
            continue

        discriminator = union_def.get("discriminator")

        if discriminator:
            # Generate discriminated union
            discriminator_field = discriminator.get("field", "t")
            discriminator_enum = discriminator.get("enum")
            data_field = discriminator.get(
                "data_field", "d"
            )  # Allow custom data field name

            # Map type names to enum values
            type_to_enum_map = {}
            if discriminator_enum and discriminator_enum in all_types:
                enum_def = all_types[discriminator_enum]
                if enum_def.get("type") == "string" and "enum" in enum_def:
                    enum_values = enum_def["enum"]
                    import re

                    for type_name in union_types:
                        # Convert PascalCase to UPPER_SNAKE_CASE
                        snake_case = re.sub(r"(?<!^)(?=[A-Z])", "_", type_name).upper()
                        # Try to find matching enum value
                        for enum_val in enum_values:
                            if (
                                enum_val.upper() == snake_case
                                or enum_val.upper().replace("_", "")
                                == snake_case.replace("_", "")
                            ):
                                type_to_enum_map[type_name] = enum_val
                                break
                        # Fallback: use the snake_case version
                        if type_name not in type_to_enum_map:
                            type_to_enum_map[type_name] = snake_case

            if language == "python":
                content = generate_python_discriminated_union(
                    union_types,
                    discriminator_enum,
                    type_to_enum_map,
                    discriminator_field,
                    data_field,
                    union_name,
                    subfolder,
                )
                ext = ".py"
                union_file = camel_to_snake(union_name)
                py_exports.append((union_file, union_name))
            else:
                content = generate_typescript_discriminated_union(
                    union_types,
                    discriminator_enum,
                    type_to_enum_map,
                    discriminator_field,
                    data_field,
                    union_name,
                    subfolder,
                )
                ext = ".ts"
                union_file = union_name.lower()
                ts_exports.append((union_file, union_name))
        else:
            # Simple union without discriminator
            if language == "python":
                content = generate_python_union(union_types, subfolder)
                content = content.replace("Union =", f"{union_name} =")
                ext = ".py"
                union_file = camel_to_snake(union_name)
                py_exports.append((union_file, union_name))
            else:
                content = generate_typescript_union(union_types, subfolder)
                content = content.replace(
                    "export type Union =", f"export type {union_name} ="
                )
                ext = ".ts"
                union_file = union_name.lower()
                ts_exports.append((union_file, union_name))
        output_path = os.path.join(target_output_dir, union_file + ext)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

    # Barrel/re-export files
    if language == "python":
        init_lines = []
        for mod, name in sorted(set(py_exports), key=lambda x: x[1]):
            init_lines.append(f"from .{mod} import {name}")
        init_path = os.path.join(target_output_dir, "__init__.py")
        with open(init_path, "w", encoding="utf-8") as f:
            f.write("\n".join(init_lines) + ("\n" if init_lines else ""))
    else:
        index_lines = []
        for mod, name in sorted(set(ts_exports), key=lambda x: x[1]):
            index_lines.append(f'export {{ {name} }} from "./{mod}";')
        index_path = os.path.join(output_dir, "index.ts")
        with open(index_path, "w", encoding="utf-8") as f:
            f.write("\n".join(index_lines) + ("\n" if index_lines else ""))

    print(f"Generated {len(enums) + len(types) + len(unions)} types for {language}")

    if language == "python":
        update_python_package_root(base_output_dir)


def main():
    parser = argparse.ArgumentParser(description="Generate types from TOML schema")
    parser.add_argument(
        "--schema",
        type=str,
        default="typegen/schema.toml",
        help="Path to TOML schema file",
    )
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output directory",
    )
    parser.add_argument(
        "--lang",
        type=str,
        required=True,
        choices=["python", "typescript"],
        help="Target language",
    )
    parser.add_argument(
        "--types-dir",
        type=str,
        help="Directory containing all TOML schema files (for global refs)",
    )
    args = parser.parse_args()

    # Load global definitions if types-dir is provided
    global_definitions = None
    type_locations = None
    if args.types_dir:
        global_definitions, type_locations = load_all_schemas(args.types_dir)

    generate_types(
        args.schema, args.output, args.lang, global_definitions, type_locations
    )


if __name__ == "__main__":
    main()
