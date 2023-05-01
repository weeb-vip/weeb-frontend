import {Link} from "react-router-dom";

function Tag({ tag, classname }: { tag: string, classname?: string }) {
  return (
    <span className={`inline-block bg-gray-200 rounded-md px-3 py-1 text-sm font-semibold text-gray-700 whitespace-nowrap ${classname || ''}`}>
      {/*<Link to={`/tags/${tag.slug}`}>*/}
        {tag}
      {/*</Link>*/}
    </span>
  )
}

export default Tag