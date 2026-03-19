"use client"
import React from 'react'
import GetImage from '@/hooks/use-getImage'
import { LzyImage } from './lazy-image'
import Image from 'next/image'

const MyImage = (
    { image, isNotApi, alt, classNameProps, load, objet_fit, public_image }
        : { image: string, isNotApi?: boolean, alt?: string, classNameProps?: string, load?: boolean, objet_fit?: string, public_image?: boolean }) => {


    // isNotApi is used to determine if the image is from a input file preview or external source
    // 

    return (
        // !public_image
        // ? 
        <LzyImage
            src={isNotApi ? image : GetImage(image)}
            alt={alt ?? "image..."}
            load={load ?? true}
            className={classNameProps ?? "w-full h-[150px] md:h-[200px] bg-accent"}
            objet_fit={objet_fit ?? 'object-contain'}
        />
        // : <Image
        //     src={isNotApi ? image : GetImage(image)}
        //     alt={alt ?? "image..."}
        //     width={150}
        //     height={200}
        //     className={classNameProps ?? "w-full h-[150px] md:h-[200px] bg-accent"}
        // />
    )
}

export default MyImage