from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..state import CardInstance


class DamageCalculator:
    
    @staticmethod
    def calculate_combat_damage(attacker: "CardInstance", defender: "CardInstance") -> tuple[int, int]:
        attacker_damage = attacker.might
        defender_damage = defender.might
        
        for mod in attacker.modifiers:
            if mod.get("type") == "buff":
                attacker_damage += mod.get("might", 0)
            
            if mod.get("type") == "assault":
                if mod.get("condition") == "while_attacking":
                    attacker_damage += mod.get("attack_bonus", 0)
        
        for mod in defender.modifiers:
            if mod.get("type") == "buff":
                defender_damage += mod.get("might", 0)
        
        return attacker_damage, defender_damage
    
    @staticmethod
    def calculate_might(unit: "CardInstance", context: str = "default") -> int:
        might = unit.might
        
        for mod in unit.modifiers:
            if mod.get("type") == "buff":
                might += mod.get("might", 0)
            
            if mod.get("type") == "assault" and context == "attacking":
                might += mod.get("attack_bonus", 0)
        
        return max(0, might)
