import { useQuery } from "@tanstack/react-query";
import {CharactersAndStaffByAnimeIdQuery, CharacterWithStaff} from "../../../gql/graphql";
import { getCharactersAndStaffByAnimeID } from "../../../services/queries";
import Loader from "../../../components/Loader";
import { SafeImage } from "../../../components/SafeImage/SafeImage";
import { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";

type Props = {
  animeId: string;
};

type FilterType = 'all' | 'main' | 'supporting' | 'minor';

export default function CharactersWithStaff({ animeId }: Props) {
  const { data, isLoading } = useQuery(getCharactersAndStaffByAnimeID(animeId));
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedCharacters, setExpandedCharacters] = useState<Set<number>>(new Set());

  const filteredData = useMemo(() => {
    if (!data || filter === 'all') return data || [];
    
    return data.filter(entry => {
      const role = entry.character.role?.toLowerCase() || '';
      switch (filter) {
        case 'main':
          return role.includes('main') || role.includes('protagonist');
        case 'supporting':
          return role.includes('supporting');
        case 'minor':
          return !role.includes('main') && !role.includes('supporting') && !role.includes('protagonist');
        default:
          return true;
      }
    });
  }, [data, filter]);

  const toggleCharacterExpanded = (index: number) => {
    setExpandedCharacters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getCharacterCardSize = (role: string) => {
    const roleStr = role?.toLowerCase() || '';
    if (roleStr.includes('main') || roleStr.includes('protagonist')) {
      return 'main'; // Larger cards for main characters
    } else if (roleStr.includes('supporting')) {
      return 'supporting'; // Medium cards
    }
    return 'minor'; // Smaller cards for minor characters
  };

  const getRoleColor = (role: string) => {
    const roleStr = role?.toLowerCase() || '';
    if (roleStr.includes('main') || roleStr.includes('protagonist')) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    } else if (roleStr.includes('supporting')) {
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    }
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
  };

  if (isLoading || !data) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All Characters' },
          { key: 'main', label: 'Main Characters' },
          { key: 'supporting', label: 'Supporting' },
          { key: 'minor', label: 'Minor Characters' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as FilterType)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Character Grid */}
      <div className="grid gap-4">
        {filteredData.map((entry, idx) => {
          const cardSize = getCharacterCardSize(entry.character.role || '');
          const isExpanded = expandedCharacters.has(idx);
          const roleColor = getRoleColor(entry.character.role || '');
          
          return (
            <div
              key={idx}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg ${
                cardSize === 'main' 
                  ? 'border-2 border-blue-200 dark:border-blue-800' 
                  : cardSize === 'supporting'
                  ? 'border border-green-200 dark:border-green-800'
                  : 'border border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Character Header */}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Character Image */}
                  <div className="flex-shrink-0">
                    <SafeImage
                      src={encodeURIComponent(`${entry.character.name}_${animeId}`)}
                      path={"characters"}
                      alt={`characters/${entry.character.name}_${animeId}`}
                      className={`object-cover rounded-lg ${
                        cardSize === 'main' 
                          ? 'h-32 w-24' 
                          : cardSize === 'supporting' 
                          ? 'h-28 w-20' 
                          : 'h-24 w-16'
                      }`}
                    />
                  </div>

                  {/* Character Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`font-bold text-gray-900 dark:text-white truncate ${
                          cardSize === 'main' ? 'text-xl' : 'text-lg'
                        }`}>
                          {entry.character.name}
                        </h3>
                        
                        {entry.character.role && (
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${roleColor}`}>
                            {entry.character.role}
                          </span>
                        )}
                        
                        {entry.character.title && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-2">
                            {entry.character.title}
                          </p>
                        )}

                        {/* Voice Actors Summary */}
                        {/* @ts-ignore */}
                        {entry.staff && entry.staff.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-medium">Voice:</span>{" "}
                              {/* @ts-ignore */}
                              {entry.staff.slice(0, 2).map((staff: any, i: number) => (
                                <span key={i}>
                                  {staff.givenName} {staff.familyName}
                                  {staff.language && ` (${staff.language})`}
                                  {/* @ts-ignore */}
                                  {i < Math.min(entry.staff.length, 2) - 1 ? ', ' : ''}
                                </span>
                              ))}
                              {/* @ts-ignore */}
                              {entry.staff.length > 2 && (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {/* @ts-ignore */}
                                  {` +${entry.staff.length - 2} more`}
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Expand Button */}
                      {/* @ts-ignore */}
                      {entry.staff && entry.staff.length > 0 && (
                        <button
                          onClick={() => toggleCharacterExpanded(idx)}
                          className="flex-shrink-0 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                          aria-label={isExpanded ? 'Show less' : 'Show more'}
                        >
                          <FontAwesomeIcon 
                            icon={isExpanded ? faChevronUp : faChevronDown} 
                            className="w-4 h-4"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Staff Details */}
              {/* @ts-ignore */}
              {isExpanded && entry.staff && entry.staff.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Voice Actors</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* @ts-ignore */}
                    {entry.staff.map((staffMember: any, staffIdx: number) => (
                      <div key={staffIdx} className="flex gap-3 p-2 bg-white dark:bg-gray-800 rounded">
                        <SafeImage
                          src={encodeURIComponent(`${staffMember.givenName}_${staffMember.familyName}`)}
                          path={"staff"}
                          alt={`${staffMember.givenName} ${staffMember.familyName}`}
                          className="h-16 w-12 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-gray-900 dark:text-white text-sm">
                            {staffMember.givenName} {staffMember.familyName}
                          </h5>
                          {staffMember.language && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              {staffMember.language}
                            </p>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                            {staffMember.birthPlace && (
                              <p>{staffMember.birthPlace}</p>
                            )}
                            {staffMember.birthday && (
                              <p>Born: {staffMember.birthday}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No characters found for the selected filter.
        </div>
      )}
    </div>
  );
}
