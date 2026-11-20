import { app } from "../../scripts/app.js";

const enabledFields = ["enabled_1", "enabled_2", "enabled_3"];
const fields = ["positive", "negative", ...[1, 2, 3].flatMap(i => [`lora_${i}`, `model_${i}`, `clip_${i}`]), ...enabledFields];
const shortcuts = [
    ["横顔", "(from side:1.6), (profile:1.5),"],
    ["後ろ姿", "(from behind:1.6), (facing away:1.6),"],
    ["ちびキャラ", "(chibi:1.5), (bad quality:0.2),"],
    ["アオリ", "from below,"],
    ["俯瞰", "from above,"],
    ["斜め構図", "dutch angle,"],
    ["正面", "straight-on,"],
    ["アップ", "close-up,"],
    ["上半身", "upper body,"],
    ["膝上", "cowboy shot,"],
    ["全身", "full body,"],
    ["白背景", "(white background:1.3), simple background, no background, comically face,"],
];

app.registerExtension({
    name: "Anima.CharacterPreset",
    async nodeCreated(node) {
        if (node.comfyClass !== "CharacterPreset") return;
        const widget = name => node.widgets.find(w => w.name === name);
        widget("positive").options.getMinHeight = () => 420;
        widget("negative").options.getMinHeight = () => 110;
        widget("negative").options.getMaxHeight = () => 110;
        const resize = () => node.setSize([Math.max(node.size[0], 510), Math.max(node.size[1], 1170)]);
        enabledFields.forEach((name, i) => { widget(name).label = `LoRA ${i + 1} ON/OFF`; });
        const read = () => Object.fromEntries(fields.map(name => [name, widget(name).value]));
        const presets = () => node.properties.character_presets ??= [];
        let loading = false;
        const saveCurrent = () => {
            const preset = presets().find(p => p.name === node.properties.character_selected);
            if (!preset) return false;
            const values = read();
            if (fields.every(name => preset.values[name] === values[name])) return false;
            preset.values = values;
            return true;
        };
        for (const name of fields) {
            const w = widget(name);
            const callback = w.callback;
            w.callback = function (...args) {
                callback?.apply(this, args);
                if (!loading && !app.configuringGraph && saveCurrent()) node.graph?.change();
            };
        }
        const grid = document.createElement("div");
        Object.assign(grid.style, {
            display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gridTemplateRows: "repeat(3, 1fr)", gap: "4px", width: "100%", height: "100%",
        });
        for (const [label, prompt] of shortcuts) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.title = prompt;
            Object.assign(button.style, {
                cursor: "pointer", color: "var(--input-text, #eee)", background: "var(--comfy-input-bg, #333)",
                border: "1px solid var(--border-color, #666)", borderRadius: "5px", fontSize: "13px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            });
            button.addEventListener("click", event => {
                event.stopPropagation();
                const w = widget("positive");
                const previous = String(w.value ?? "").trimEnd();
                w.value = previous ? `${previous}${previous.endsWith(",") ? "" : ","}\n${prompt}` : prompt;
                w.callback?.(w.value, app.canvas, node);
                node.graph?.change();
                node.setDirtyCanvas(true, true);
            });
            grid.appendChild(button);
        }
        const toolbar = node.addDOMWidget("prompt_shortcuts", "custom", grid, {
            serialize: false, getMinHeight: () => 110, getMaxHeight: () => 110,
        });
        toolbar.serialize = false;
        node.widgets.splice(node.widgets.indexOf(toolbar), 1);
        node.widgets.splice(node.widgets.indexOf(widget("positive")) + 1, 0, toolbar);
        const refresh = () => {
            selector.options.values = presets().map(p => p.name);
            selector.value = node.properties.character_selected || "";
            node.setDirtyCanvas(true, true);
        };
        const select = name => {
            const preset = presets().find(p => p.name === name);
            if (!preset) return;
            saveCurrent();
            loading = true;
            node.properties.character_selected = name;
            try {
                for (const field of fields) {
                    const w = widget(field);
                    const value = enabledFields.includes(field) ? (preset.values[field] ?? true) : preset.values[field];
                    if (value !== undefined) {
                        w.value = value;
                        w.callback?.(w.value, app.canvas, node);
                    }
                }
            } finally {
                loading = false;
            }
            refresh();
            node.graph?.change();
        };
        const selector = node.addWidget("combo", "Character", "", select, { values: [], serialize: false });
        selector.serialize = false;
        const addButton = (name, callback) => {
            const button = node.addWidget("button", name, null, callback, { serialize: false });
            button.serialize = false;
        };
        addButton("Add character (copy current)", () => {
            const name = window.prompt("Character name")?.trim();
            if (!name) return;
            if (presets().some(p => p.name === name)) return window.alert("That character already exists.");
            presets().push({ name, values: read() });
            select(name);
        });
        addButton("Delete character", () => {
            const name = node.properties.character_selected;
            if (!name || !window.confirm(`Delete preset: ${name}?`)) return;
            node.properties.character_presets = presets().filter(p => p.name !== name);
            node.properties.character_selected = "";
            if (presets().length) select(presets()[0].name);
            refresh();
            node.graph?.change();
        });
        const configure = node.onConfigure;
        node.onConfigure = function (data) {
            loading = true;
            try {
                configure?.call(this, data);
                // Older workflows only contain the original eleven settings.
                enabledFields.forEach((name, i) => {
                    const value = data.widgets_values?.[fields.length - enabledFields.length + i];
                    widget(name).value = typeof value === "boolean" ? value : true;
                });
            } finally {
                loading = false;
            }
            saveCurrent();
            refresh();
            resize();
        };
        const serialize = node.onSerialize;
        node.onSerialize = function (data) {
            if (!loading) saveCurrent();
            serialize?.call(this, data);
            if (data.widgets_values) data.widgets_values = node.widgets.filter(w => w.serialize !== false).map(w => w.value);
            if (data.properties) {
                data.properties.character_presets = presets().map(p => ({ name: p.name, values: { ...p.values } }));
            }
        };
        refresh();
        resize();
    }
});
