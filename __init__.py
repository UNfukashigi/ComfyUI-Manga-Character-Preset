import folder_paths
from nodes import CLIPTextEncode, LoraLoader


class CharacterPreset:
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {"model": ("MODEL",), "clip": ("CLIP",)}
        inputs["positive"] = ("STRING", {"multiline": True, "dynamicPrompts": True})
        inputs["negative"] = ("STRING", {"multiline": True, "dynamicPrompts": True})
        names = ["None"] + folder_paths.get_filename_list("loras")
        for i in range(1, 4):
            inputs[f"lora_{i}"] = (names,)
            for kind in ("model", "clip"):
                inputs[f"{kind}_{i}"] = ("FLOAT", {"default": 1.0, "min": -100.0, "max": 100.0, "step": 0.01})
        return {"required": inputs, "optional": {
            f"enabled_{i}": ("BOOLEAN", {"default": True, "label_on": "ON", "label_off": "OFF"})
            for i in range(1, 4)
        }}

    RETURN_TYPES = ("MODEL", "CONDITIONING", "CONDITIONING")
    RETURN_NAMES = ("model", "positive", "negative")
    FUNCTION = "encode"
    CATEGORY = "Anima"

    def encode(self, model, clip, positive, negative, **settings):
        for i in range(1, 4):
            name = settings[f"lora_{i}"]
            if settings.get(f"enabled_{i}", True) and name != "None":
                model, clip = LoraLoader().load_lora(model, clip, name, settings[f"model_{i}"], settings[f"clip_{i}"])
        encoder = CLIPTextEncode()
        return (model, encoder.encode(clip, positive)[0], encoder.encode(clip, negative)[0])


NODE_CLASS_MAPPINGS = {"CharacterPreset": CharacterPreset}
NODE_DISPLAY_NAME_MAPPINGS = {"CharacterPreset": "Character Preset (Prompt + 3 LoRAs)"}
WEB_DIRECTORY = "./web"
