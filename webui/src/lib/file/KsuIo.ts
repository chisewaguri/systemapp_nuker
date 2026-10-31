import { io } from 'kernelsu-alt'
import { File } from './File'

export class KsuIo extends File {
  async exist(path: string): Promise<boolean> {
    const file = io.File(path)
    return file.exists() || file.isSymlink()
  }

  async isDirectory(path: string): Promise<boolean> {
    return io.File(path).isDirectory()
  }

  async read(path: string): Promise<string> {
    const source = io.File(path)
    if (!source.isFile()) throw new Error(`File.read failed: ${path}`)
    const stream = io.FileInputStream()
    const id = stream.open(path)
    if (!id) throw new Error(`File.read failed: ${path}`)
    const decoder = new TextDecoder()
    let content = ''
    let bytesRead = 0
    try {
      const length = source.length()
      while (bytesRead < length) {
        const chunk = stream.read(id, 32768)
        if (!chunk) throw new Error(`File.read failed: ${path}`)
        const bytes = Uint8Array.from(atob(chunk), char => char.charCodeAt(0))
        bytesRead += bytes.length
        if (bytesRead > length) throw new Error(`File.read failed: ${path}`)
        content += decoder.decode(bytes, { stream: true })
      }
      return content + decoder.decode()
    } finally {
      if (!stream.close(id)) throw new Error(`File.read failed to close: ${path}`)
    }
  }

  async readIfExists(path: string): Promise<string> {
    const source = io.File(path)
    return source.isFile() ? this.read(path) : ''
  }

  async write(path: string, data: string): Promise<void> {
    const temporary = `${path}.tmp`
    const stream = io.FileOutputStream()
    const id = stream.open(temporary, false)
    if (!id) throw new Error(`File.write failed: ${temporary}`)
    const bytes = new TextEncoder().encode(`${data.trim()}\n`)
    let written = false
    try {
      for (let offset = 0; offset < bytes.length; offset += 32768) {
        const chunk = bytes.subarray(offset, offset + 32768)
        let binary = ''
        for (const byte of chunk) binary += String.fromCharCode(byte)
        if (!stream.write(id, btoa(binary))) throw new Error(`File.write failed: ${temporary}`)
      }
      if (!stream.flush(id)) throw new Error(`File.write failed: ${temporary}`)
      written = true
    } finally {
      if (!stream.close(id)) throw new Error(`File.write failed to close: ${temporary}`)
      if (!written) io.File(temporary).delete()
    }
    const target = io.File(path)
    if ((target.exists() || target.isSymlink()) && !target.delete()) {
      io.File(temporary).delete()
      throw new Error(`File.write failed to replace: ${path}`)
    }
    if (!io.File(temporary).renameTo(path)) {
      io.File(temporary).delete()
      throw new Error(`File.write failed to move: ${temporary} -> ${path}`)
    }
  }

  async move(src: string, dst: string): Promise<void> {
    const source = io.File(src)
    if (!source.exists() && !source.isSymlink()) throw new Error(`File.move failed: ${src} does not exist`)
    const target = io.File(dst)
    if ((target.exists() || target.isSymlink()) && !target.deleteRecursive()) throw new Error(`File.move failed: could not replace ${dst}`)
    if (!source.renameTo(dst)) throw new Error(`File.move failed: ${src} -> ${dst}`)
  }

  async delete(path: string): Promise<void> {
    const target = io.File(path)
    if ((target.exists() || target.isSymlink()) && !target.deleteRecursive()) throw new Error(`File.delete failed: ${path}`)
  }

  async createDirectory(dir: string): Promise<void> {
    const target = io.File(dir)
    if (!target.isDirectory() && !target.mkdirs()) throw new Error(`File.createDirectory failed: ${dir}`)
  }
}
