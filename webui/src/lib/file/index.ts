import { io } from 'kernelsu-alt'
import type { File } from './File'
import { KsuIo } from './KsuIo'
import { ShellFile } from './ShellFile'

export const file: File = io.support ? new KsuIo() : new ShellFile()
