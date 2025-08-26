import {Link} from "react-router-dom";

function Tag({ tag, classname }: { tag: string, classname?: string }) {
  return (
    <span className={`inline-block bg-gray-200 dark:bg-gray-600 rounded-md px-3 py-1 text-base font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap transition-colors duration-300 ${classname || ''}`}>
      {/*<Link to={`/tags/${tag.slug}`}>*/}
        {tag}
      {/*</Link>*/}
    </span>
  )
}

export default Tag