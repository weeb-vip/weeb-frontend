import { useQuery } from "@tanstack/react-query";
import {CharactersAndStaffByAnimeIdQuery, CharacterWithStaff} from "../../../gql/graphql";
import { getCharactersAndStaffByAnimeID } from "../../../services/queries";
import Loader from "../../../components/Loader";
import { SafeImage } from "../../../components/SafeImage/SafeImage";

type Props = {
  animeId: string;
};

export default function CharactersWithStaff({ animeId }: Props) {
  const { data, isLoading } = useQuery(getCharactersAndStaffByAnimeID(animeId));

  if (isLoading || !data) return <Loader />;


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {data.map((entry, idx) => (
        <div key={idx} className="bg-white rounded-md shadow p-4 flex flex-col gap-4">
          {/* Character Info */}
          <div className="flex gap-4">
            <SafeImage
              src={encodeURIComponent(`${entry.character.name}_${animeId}`)}
              path={"characters"}
              alt={`characters/${entry.character.name}_${animeId}`}
              className="h-24 w-16 object-cover rounded"
            />
            <div>
              <h3 className="font-bold text-lg text-gray-800">{entry.character.name}</h3>
              <p className="text-sm text-gray-500">{entry.character.role}</p>
              {entry.character.title && (
                <p className="text-sm text-gray-400 italic">{entry.character.title}</p>
              )}
            </div>
          </div>

          {/* Multiple Staff Info */}
          <div className="flex flex-col gap-4 border-t pt-4">
            {/* @ts-ignore */}
            {entry.staff.map((staffMember, staffIdx) => (
              <div key={staffIdx} className="flex gap-4">
                <SafeImage
                  src={encodeURIComponent(`${staffMember.givenName}_${staffMember.familyName}`)}
                  path={"staff"}
                  alt={`${staffMember.givenName} ${staffMember.familyName}`}
                  className="h-24 w-16 object-cover rounded"
                />
                <div>
                  <h4 className="font-semibold text-gray-700">
                    {staffMember.givenName} {staffMember.familyName}
                  </h4>
                  {staffMember.language && (
                    <p className="text-xs text-gray-500">Language: {staffMember.language}</p>
                  )}
                  {staffMember.birthPlace && (
                    <p className="text-xs text-gray-500">{staffMember.birthPlace}</p>
                  )}
                  {staffMember.birthday && (
                    <p className="text-xs text-gray-400">Born: {staffMember.birthday}</p>
                  )}
                  {staffMember.bloodType && (
                    <p className="text-xs text-gray-500">Blood Type: {staffMember.bloodType}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
