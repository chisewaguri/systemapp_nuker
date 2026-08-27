export const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`

export const shellFileFilter = (fileType: string) => fileType === 'any'
  ? 'echo "f|$f"'
  : `ext=${shellQuote(fileType)}; [ "\${f##*.}" = "$ext" ] && echo "f|$f"`
