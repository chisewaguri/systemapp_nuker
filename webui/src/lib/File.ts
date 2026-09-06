import { exec } from 'kernelsu-alt'
import { shellQuote } from './shell'

export class File {
  static async exist(path: string): Promise<boolean> {
    const { errno } = await exec(`[ -e ${shellQuote(path)} ]`)
    return errno === 0
  }

  static async isDirectory(path: string): Promise<boolean> {
    const { errno } = await exec(`[ -d ${shellQuote(path)} ]`)
    return errno === 0
  }

  static async read(path: string): Promise<string> {
    const result = await exec(`cat ${shellQuote(path)}`)
    if (result.errno !== 0) throw new Error(`File.read failed (${result.errno}): ${result.stderr}`)
    return result.stdout
  }

  static async readIfExists(path: string): Promise<string> {
    const quoted = shellQuote(path)
    const result = await exec(`[ ! -e ${quoted} ] || cat ${quoted}`)
    if (result.errno !== 0) throw new Error(`File.readIfExists failed (${result.errno}): ${result.stderr}`)
    return result.stdout
  }

  static async write(path: string, data: string): Promise<void> {
    const result = await exec(`
      target=${shellQuote(path)}
      content=${shellQuote(data.trim())}

      # Prefer an atomic replacement, but keep compatibility with root hosts
      # that allow writing the existing file while rejecting sibling files in
      # the persistent directory (for example, some Magisk Alpha setups).
      if tmp=$(busybox mktemp "$target.tmp.XXXXXX"); then
        trap 'rm -f "$tmp"' EXIT HUP INT TERM
        if printf '%s\\n' "$content" > "$tmp"; then
          atomic=true
          if [ -e "$target" ]; then
            mode=$(busybox stat -c %a "$target") || atomic=false
            owner=$(busybox stat -c %u:%g "$target") || atomic=false
            [ "$atomic" = true ] && busybox chmod "$mode" "$tmp" || atomic=false
            [ "$atomic" = true ] && busybox chown "$owner" "$tmp" || atomic=false
            [ "$atomic" = true ] && busybox chcon --reference="$target" "$tmp" >/dev/null 2>&1 || true
          fi
          [ "$atomic" = true ] && busybox mv -f "$tmp" "$target" && exit 0
        fi
      fi

      # The direct write is intentionally the last resort: it preserves the
      # behavior supported by older WebUI hosts when atomic staging is not.
      printf '%s\\n' "$content" > "$target"
    `)
    if (result.errno !== 0) throw new Error(`File.write failed (${result.errno}): ${result.stderr}`)
  }

  static async move(src: string, dst: string): Promise<void> {
    const result = await exec(`mv -f ${shellQuote(src)} ${shellQuote(dst)}`)
    if (result.errno !== 0) throw new Error(`File.move failed (${result.errno}): ${result.stderr}`)
  }

  static async copy(src: string, dst: string): Promise<void> {
    const result = await exec(`cp -rf ${shellQuote(src)} ${shellQuote(dst)}`)
    if (result.errno !== 0) throw new Error(`File.copy failed (${result.errno}): ${result.stderr}`)
  }

  static async delete(path: string): Promise<void> {
    const result = await exec(`rm -rf ${shellQuote(path)}`)
    if (result.errno !== 0) throw new Error(`File.delete failed (${result.errno}): ${result.stderr}`)
  }

  static async createFile(path: string): Promise<void> {
    const result = await exec(`touch ${shellQuote(path)}`)
    if (result.errno !== 0) throw new Error(`File.createFile failed (${result.errno}): ${result.stderr}`)
  }

  static async createDirectory(dir: string): Promise<void> {
    const result = await exec(`mkdir -p ${shellQuote(dir)}`)
    if (result.errno !== 0) throw new Error(`File.createDirectory failed (${result.errno}): ${result.stderr}`)
  }
}
