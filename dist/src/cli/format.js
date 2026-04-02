import yaml from 'js-yaml';
export function formatOutput(snapshot, format) {
    // Deep clone to avoid modifying original snapshot if memory is reused
    const copy = JSON.parse(JSON.stringify(snapshot));
    if (format === 'compact') {
        const stripStyles = (node) => {
            delete node.styles;
            delete node.bounds;
            if (node.children)
                node.children.forEach(stripStyles);
        };
        if (copy.tree && copy.tree[0])
            stripStyles(copy.tree[0]);
        if (copy.added)
            copy.added.forEach(stripStyles);
        if (copy.removed)
            copy.removed.forEach(stripStyles);
        return JSON.stringify(copy, null, 2);
    }
    if (format === 'yaml') {
        return yaml.dump(copy, { noRefs: true, skipInvalid: true });
    }
    return JSON.stringify(copy, null, 2);
}
