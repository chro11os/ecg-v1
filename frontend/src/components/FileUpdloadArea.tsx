import { useCallback } from 'react'
import { useDropzone } from "react-dropzone";

function FileUploadArea() {

    const onDrop = useCallback(acceptedFiles: => {
        // do something with the files 
    }, [])

    const { getRootProps, getInputProps, isDragActive } =
        useDropzone({ onDrop })

    return (
        <div {...getRootProps()}>
            <input {...getInputProps()} />
            {
                isDragActive ?
                    <p>Drop the files here ...</> :
                    <p>Drang 'n' drop some files here, or click to select files</p>
            }
        </div>
    )
}

export default FileUploadArea;
