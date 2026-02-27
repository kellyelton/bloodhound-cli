function hasValidChangesetFile(files) {
    return files.some((file) => {
        if (!file.startsWith('.changeset/')) {
            return false;
        }

        if (!file.endsWith('.md')) {
            return false;
        }

        return file !== '.changeset/README.md';
    });
}

module.exports = {
    hasValidChangesetFile
};
