import Image from "next/image";

/**
 * The blurred backdrop every page sits on. The scrim is a prop because the
 * index wants the homepage's lighter wash while a post wants the image pushed
 * further back, out of the way of sustained reading.
 *
 * -z-10, not z-0: this renders inside the content's stacking context, and a
 * positioned element at z-0 would paint over every unpositioned paragraph.
 */
export default function GlassBackground({
  scrim = "bg-black/60",
}: {
  scrim?: string;
}) {
  return (
    <div className="fixed inset-0 -z-10">
      <Image
        src="/geometrized_image.png"
        alt=""
        fill
        className="object-cover"
        priority
        quality={100}
      />
      <div className={`absolute inset-0 backdrop-blur-md ${scrim}`}></div>
    </div>
  );
}
